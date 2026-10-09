import { test, expect } from '../../fixtures/test.js';
import { signUpThroughApi, uniqueEmail } from '../../utils/helpers.js';
import { openTestDatabase } from '../helpers/database.js';

test.describe('Orchard Quality Lab — database persistence and integrity', () => {
  test.skip(
    Boolean(process.env.BASE_URL),
    'Direct SQLite assertions require the local test server and its database file.',
  );
  test('DB-01: schema is seeded and foreign-key integrity is clean', async () => {
    const db = openTestDatabase();
    try {
      const integrity = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      expect(integrity.integrity_check).toBe('ok');
      const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
      expect(fkViolations).toHaveLength(0);
      const products = db.prepare('SELECT COUNT(*) AS count FROM products').get() as {
        count: number;
      };
      const seededDemo = db
        .prepare('SELECT COUNT(*) AS count FROM users WHERE email = ?')
        .get('test14@gmail.com') as { count: number };
      expect(products.count).toBeGreaterThanOrEqual(8);
      expect(seededDemo.count).toBe(1);
    } finally {
      db.close();
    }
  });

  test('DB-02: API-created account is persisted with a password hash, never plaintext', async ({
    request,
  }) => {
    const email = uniqueEmail('db-user');
    await signUpThroughApi(request, email);
    const db = openTestDatabase();
    try {
      const user = db
        .prepare(
          'SELECT first_name, last_name, email, password_salt, password_hash FROM users WHERE email=?',
        )
        .get(email) as
        | {
            first_name: string;
            last_name: string;
            email: string;
            password_salt: string;
            password_hash: string;
          }
        | undefined;
      expect(user).toBeTruthy();
      expect(user?.first_name).toBe('API');
      expect(user?.last_name).toBe('Tester');
      expect(user?.password_salt).toBeTruthy();
      expect(user?.password_hash).toHaveLength(128);
      expect(user?.password_hash).not.toBe('Practice123!');
    } finally {
      db.close();
    }
  });

  test('DB-03: order, line items, stock decrement, and cart cleanup are committed consistently', async ({
    request,
  }) => {
    const beforeDb = openTestDatabase();
    let beforeStock: number;
    try {
      beforeStock = (
        beforeDb.prepare('SELECT stock FROM products WHERE id=?').get('phone-15-pro') as {
          stock: number;
        }
      ).stock;
    } finally {
      beforeDb.close();
    }

    await signUpThroughApi(request, uniqueEmail('db-order'));
    await request
      .post('/api/cart/items', {
        data: { productId: 'phone-15-pro', quantity: 3, color: 'Graphite', storage: '512GB' },
      })
      .then(async (r) => expect(r.status()).toBe(201));
    const response = await request.post('/api/orders', {
      data: {
        shipping: {
          fullName: 'DB Tester',
          address: '1 Database Lane',
          city: 'Nashik',
          zip: '422001',
          country: 'in',
        },
        paymentMethod: 'Credit Card',
      },
    });
    expect(response.status()).toBe(201);
    const orderId = (await response.json()).order.id as string;

    const db = openTestDatabase();
    try {
      const order = db
        .prepare('SELECT id, total_cents, status FROM orders WHERE id=?')
        .get(orderId) as { id: string; total_cents: number; status: string } | undefined;
      const item = db
        .prepare(
          'SELECT order_id, product_id, quantity, unit_price_cents FROM order_items WHERE order_id=?',
        )
        .get(orderId) as
        | { order_id: string; product_id: string; quantity: number; unit_price_cents: number }
        | undefined;
      const afterStock = (
        db.prepare('SELECT stock FROM products WHERE id=?').get('phone-15-pro') as { stock: number }
      ).stock;
      const carts = db
        .prepare(
          'SELECT COUNT(*) AS count FROM cart_items WHERE user_id=(SELECT user_id FROM orders WHERE id=?)',
        )
        .get(orderId) as { count: number };
      expect(order).toMatchObject({ id: orderId, total_cents: 299700, status: 'Processing' });
      expect(item).toMatchObject({
        order_id: orderId,
        product_id: 'phone-15-pro',
        quantity: 3,
        unit_price_cents: 99900,
      });
      expect(afterStock).toBe(beforeStock - 3);
      expect(carts.count).toBe(0);
    } finally {
      db.close();
    }
  });

  test('DB-04: support API writes a durable support ticket record', async ({ request }) => {
    const email = uniqueEmail('db-support');
    const beforeDb = openTestDatabase();
    let beforeCount: number;
    try {
      beforeCount = (
        beforeDb.prepare('SELECT COUNT(*) AS count FROM support_tickets').get() as { count: number }
      ).count;
    } finally {
      beforeDb.close();
    }
    const response = await request.post('/api/support', {
      data: {
        name: 'DB Validation',
        email,
        message: 'Support persistence validation from the database suite.',
      },
    });
    expect(response.status()).toBe(201);
    const ticketId = (await response.json()).ticket.id as string;
    const db = openTestDatabase();
    try {
      const ticket = db
        .prepare('SELECT id, email, status, message FROM support_tickets WHERE id=?')
        .get(ticketId) as
        { id: string; email: string; status: string; message: string } | undefined;
      const afterCount = (
        db.prepare('SELECT COUNT(*) AS count FROM support_tickets').get() as { count: number }
      ).count;
      expect(ticket).toMatchObject({ id: ticketId, email, status: 'Open' });
      expect(ticket?.message).toContain('database suite');
      expect(afterCount).toBe(beforeCount + 1);
    } finally {
      db.close();
    }
  });
});

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from 'node:sqlite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
const DB_FILE = resolve(process.cwd(), process.env.DATABASE_PATH || 'data/orchard.sqlite');
const PORT = Number(process.env.PORT || 3000);
const QA_MODE = process.env.QA_MODE !== 'false';

mkdirSync(dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
type DbRow = Record<string, SQLOutputValue>;
type JsonObject = Record<string, unknown>;
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorProperty(error: unknown, key: string): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as Record<string, unknown>)[key];
}
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
    image TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 100 CHECK(stock >= 0),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    color TEXT NOT NULL DEFAULT 'Natural Titanium',
    storage TEXT NOT NULL DEFAULT '128GB',
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
    created_at TEXT NOT NULL,
    UNIQUE(user_id, product_id, color, storage)
  );
  CREATE TABLE IF NOT EXISTS wishlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    created_at TEXT NOT NULL,
    UNIQUE(user_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
    status TEXT NOT NULL DEFAULT 'Processing',
    shipping_json TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_image TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
    color TEXT NOT NULL,
    storage TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS return_requests (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_id TEXT NOT NULL REFERENCES orders(id),
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Requested',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    order_id TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

const now = () => new Date().toISOString();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const passHash = (password: string, salt: string) => scryptSync(password, salt, 64).toString('hex');
const DEMO_PRODUCTS = [
  { id: 'phone-15-pro', sku: 'OR-P15P', name: 'Orchard Phone 15 Pro', category: 'phones', description: 'Titanium. Powerful. Pro camera system.', price: 99900, image: '/assets/phone-pro.svg', tag: 'BESTSELLER', stock: 60 },
  { id: 'phone-15', sku: 'OR-P15', name: 'Orchard Phone 15', category: 'phones', description: 'A brilliant everyday phone, built to last.', price: 79900, image: '/assets/phone.svg', tag: 'POPULAR', stock: 80 },
  { id: 'buds-pro', sku: 'OR-BP2', name: 'Orchard Buds Pro', category: 'audio', description: 'Immersive sound. Adaptive noise control.', price: 24900, image: '/assets/buds.svg', tag: 'NEW', stock: 120 },
  { id: 'watch-series-9', sku: 'OR-W9', name: 'Orchard Watch Series 9', category: 'wearables', description: 'A healthier, more connected day starts here.', price: 39900, image: '/assets/watch.svg', tag: '', stock: 75 },
  { id: 'tablet-air', sku: 'OR-TA', name: 'Orchard Tab Air', category: 'computers', description: 'Big ideas. Beautifully portable.', price: 59900, image: '/assets/tablet.svg', tag: '', stock: 50 },
  { id: 'laptop-air', sku: 'OR-LA', name: 'Orchard Book Air', category: 'computers', description: 'Power that travels light.', price: 129900, image: '/assets/laptop.svg', tag: 'PRO PICK', stock: 35 },
  { id: 'clear-case', sku: 'OR-CC', name: 'Clear Protective Case', category: 'accessories', description: 'Everyday protection, crystal clear.', price: 4900, image: '/assets/case.svg', tag: '', stock: 180 },
  { id: 'usb-c-charger', sku: 'OR-CH', name: '35W USB-C Power Adapter', category: 'accessories', description: 'Compact fast charging for your devices.', price: 3900, image: '/assets/charger.svg', tag: '', stock: 200 }
];

const productCount = Number((db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n);
if (productCount === 0) {
  const insertProduct = db.prepare('INSERT INTO products (id, sku, name, category, description, price_cents, image, tag, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const p of DEMO_PRODUCTS) insertProduct.run(p.id, p.sku, p.name, p.category, p.description, p.price, p.image, p.tag, p.stock, now());
}
const seeded = db.prepare('SELECT id FROM users WHERE email = ?').get('test14@gmail.com');
if (!seeded && process.env.NODE_ENV !== 'production') {
  const salt = 'orchard-demo-seed-salt-v1';
  db.prepare('INSERT INTO users (first_name, last_name, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('Demo', 'Tester', 'test14@gmail.com', salt, passHash('Test1454test', salt), now());
}

function safeUser(row: DbRow | undefined | null) {
  if (!row) return null;
  const firstName = String(row.first_name);
  const lastName = String(row.last_name);
  return {
    id: Number(row.id),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: String(row.email),
    createdAt: String(row.created_at),
  };
}
function sendJson(res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body), ...headers });
  res.end(body);
}
function fail(res: ServerResponse, status: number, code: string, message: string) {
  sendJson(res, status, { error: code, message });
}
async function readBody(req: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > 1_000_000) throw Object.assign(new Error('Request body is too large.'), { status: 413, code: 'BODY_TOO_LARGE' });
    chunks.push(part);
  }
  if (!chunks.length) return {};
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400, code: 'INVALID_JSON' });
  }
  if (!isJsonObject(body)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { status: 400, code: 'INVALID_JSON' });
  }
  return body;
}
function cookieToken(req: IncomingMessage) {
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)orchard_sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
function sessionCookie(token: string, maxAge = 60 * 60 * 24 * 7) {
  return `orchard_sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
function createSession(userId: number) {
  const token = randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)').run(userId, hash(token), expiry, now());
  return token;
}
function getUser(req: IncomingMessage) {
  const token = cookieToken(req);
  if (!token) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(hash(token), now());
  return row ? safeUser(row) : null;
}
function requireUser(req: IncomingMessage, res: ServerResponse) {
  const user = getUser(req);
  if (!user) fail(res, 401, 'UNAUTHENTICATED', 'Sign in is required for this action.');
  return user;
}
function asProduct(row: DbRow) {
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    category: String(row.category),
    description: String(row.description),
    priceCents: Number(row.price_cents),
    price: Number(row.price_cents) / 100,
    image: String(row.image),
    tag: String(row.tag),
    stock: Number(row.stock),
  };
}
function listCart(userId: number) {
  const rows = db.prepare(`SELECT ci.id AS cart_item_id, ci.quantity, ci.color, ci.storage, p.* FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=? ORDER BY ci.id DESC`).all(userId) as DbRow[];
  return rows.map((r) => ({ cartItemId: Number(r.cart_item_id), ...asProduct(r), quantity: Number(r.quantity), color: String(r.color), storage: String(r.storage), lineTotalCents: Number(r.price_cents) * Number(r.quantity) }));
}
function orderWithItems(orderId: string, userId?: number) {
  const order = userId === undefined
    ? db.prepare('SELECT * FROM orders WHERE id=?').get(orderId) as DbRow | undefined
    : db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(orderId, userId) as DbRow | undefined;
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').all(orderId) as DbRow[];
  return {
    id: String(order.id), userId: Number(order.user_id), totalCents: Number(order.total_cents), total: Number(order.total_cents) / 100,
    status: String(order.status), shipping: JSON.parse(String(order.shipping_json)), paymentMethod: String(order.payment_method), createdAt: String(order.created_at),
    items: items.map((i) => ({ id: Number(i.id), productId: String(i.product_id), name: String(i.product_name), image: String(i.product_image), unitPriceCents: Number(i.unit_price_cents), unitPrice: Number(i.unit_price_cents) / 100, quantity: Number(i.quantity), color: String(i.color), storage: String(i.storage), lineTotalCents: Number(i.unit_price_cents) * Number(i.quantity) }))
  };
}
function orderId() { return `ORD-${randomBytes(3).toString('hex').toUpperCase()}`; }
function returnId() { return `RET-${randomBytes(3).toString('hex').toUpperCase()}`; }
function ticketId() { return `SUP-${randomBytes(3).toString('hex').toUpperCase()}`; }

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method || 'GET';
  const path = url.pathname.replace(/\/$/, '') || '/';

  if (method === 'GET' && path === '/api/health') {
    const ping = db.prepare('SELECT 1 AS ok').get() as { ok: number };
    return sendJson(res, 200, { status: 'ok', service: 'orchard-quality-lab', database: ping.ok === 1 ? 'connected' : 'error', timestamp: now(), version: '1.0.0' });
  }
  if (method === 'GET' && path === '/api') {
    return sendJson(res, 200, { name: 'Orchard Quality Lab API', baseUrl: '/', authentication: 'HttpOnly orchard_sid cookie', endpoints: [
      'GET /api/health', 'GET /openapi.json', 'GET /api/products', 'GET /api/products/:id', 'POST /api/auth/signup', 'POST /api/auth/signin', 'POST /api/auth/signout', 'GET /api/auth/me',
      'GET /api/cart', 'POST /api/cart/items', 'PATCH /api/cart/items/:cartItemId', 'DELETE /api/cart/items/:cartItemId', 'GET /api/wishlist', 'POST /api/wishlist/:productId',
      'DELETE /api/wishlist/:productId', 'GET /api/orders', 'POST /api/orders', 'GET /api/orders/:id', 'PATCH /api/orders/:id/status', 'POST /api/orders/:id/cancel',
      'GET /api/returns', 'POST /api/returns', 'POST /api/support', 'POST /api/auth/password/forgot', 'POST /api/auth/password/reset', 'GET /api/qa/db-summary'
    ] });
  }
  if (method === 'GET' && path === '/api/qa/db-summary') {
    if (!QA_MODE) return fail(res, 404, 'NOT_FOUND', 'QA inspection endpoints are disabled.');
    const tables = ['users', 'products', 'sessions', 'cart_items', 'wishlist_items', 'orders', 'order_items', 'return_requests', 'support_tickets', 'password_reset_tokens'];
    const counts: Record<string, number> = {};
    for (const table of tables) counts[table] = Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
    return sendJson(res, 200, { database: 'sqlite', connected: true, counts, checkedAt: now(), note: 'Safe aggregate-only view; raw SQL and credentials are never exposed.' });
  }

  if (method === 'GET' && path === '/api/products') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const category = (url.searchParams.get('category') || '').trim();
    const sort = url.searchParams.get('sort') || 'featured';
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(24, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '8', 10) || 8));
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (q) { where.push('(name LIKE ? OR description LIKE ? OR sku LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (category && category !== 'all') { where.push('category=?'); params.push(category); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderBy = sort === 'price-asc' ? 'price_cents ASC, name ASC' : sort === 'price-desc' ? 'price_cents DESC, name ASC' : sort === 'name' ? 'name ASC' : "CASE WHEN tag='BESTSELLER' THEN 0 WHEN tag='NEW' THEN 1 ELSE 2 END, id ASC";
    const total = Number((db.prepare(`SELECT COUNT(*) AS n FROM products ${whereSql}`).get(...params) as { n: number }).n);
    const rows = db.prepare(`SELECT * FROM products ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit) as DbRow[];
    return sendJson(res, 200, { data: rows.map(asProduct), pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, filters: { q, category, sort } });
  }
  const productMatch = path.match(/^\/api\/products\/([a-zA-Z0-9-]+)$/);
  if (method === 'GET' && productMatch) {
    const row = db.prepare('SELECT * FROM products WHERE id=?').get(productMatch[1]);
    if (!row) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'No product exists with that id.');
    return sendJson(res, 200, { data: asProduct(row) });
  }

  if (method === 'POST' && path === '/api/auth/signup') {
    const body = await readBody(req);
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!firstName || !lastName || !email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || body.acceptTerms !== true) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Provide a valid name and email, a password of at least 8 characters, and accept the terms.');
    }
    const salt = randomBytes(16).toString('hex');
    try {
      const result = db.prepare('INSERT INTO users (first_name, last_name, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(firstName, lastName, email, salt, passHash(password, salt), now());
      const id = Number(result.lastInsertRowid);
      const token = createSession(id);
      const user = safeUser(db.prepare('SELECT * FROM users WHERE id=?').get(id));
      return sendJson(res, 201, { user, message: 'Account created successfully.' }, { 'set-cookie': sessionCookie(token) });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('UNIQUE')) return fail(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists.');
      throw error;
    }
  }
  if (method === 'POST' && path === '/api/auth/signin') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return fail(res, 400, 'VALIDATION_ERROR', 'Email and password are required.');
    const row = db.prepare('SELECT * FROM users WHERE email=?').get(email) as DbRow | undefined;
    const suppliedHash = row ? passHash(password, String(row.password_salt)) : passHash(password, 'no-such-user-salt');
    const expected = row ? String(row.password_hash) : '0'.repeat(128);
    const valid = suppliedHash.length === expected.length && timingSafeEqual(Buffer.from(suppliedHash), Buffer.from(expected));
    if (!row || !valid) return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const token = createSession(Number(row.id));
    return sendJson(res, 200, { user: safeUser(row), message: 'Signed in successfully.' }, { 'set-cookie': sessionCookie(token, body.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7) });
  }
  if (method === 'POST' && path === '/api/auth/signout') {
    const token = cookieToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
    return sendJson(res, 200, { message: 'Signed out.' }, { 'set-cookie': sessionCookie('', 0) });
  }
  if (method === 'GET' && path === '/api/auth/me') {
    const user = getUser(req);
    if (!user) return fail(res, 401, 'UNAUTHENTICATED', 'You are not signed in.');
    return sendJson(res, 200, { user });
  }
  if (method === 'POST' && path === '/api/auth/password/forgot') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'VALIDATION_ERROR', 'Enter a valid email address.');
    const user = db.prepare('SELECT id FROM users WHERE email=?').get(email) as { id: number } | undefined;
    const response: { message: string; demoResetToken?: string } = { message: 'If an account exists for that email, reset instructions have been prepared.' };
    if (user) {
      const token = randomBytes(24).toString('hex');
      db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, consumed_at) VALUES (?, ?, ?, NULL)').run(user.id, hash(token), new Date(Date.now() + 15 * 60 * 1000).toISOString());
      if (process.env.NODE_ENV !== 'production' && QA_MODE) response.demoResetToken = token;
    }
    return sendJson(res, 200, response);
  }
  if (method === 'POST' && path === '/api/auth/password/reset') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const token = String(body.token || '');
    const password = String(body.newPassword || '');
    if (!email || !token || password.length < 8) return fail(res, 400, 'VALIDATION_ERROR', 'Email, reset token, and a password of at least 8 characters are required.');
    const reset = db.prepare(`SELECT prt.id, prt.user_id FROM password_reset_tokens prt JOIN users u ON u.id=prt.user_id WHERE u.email=? AND prt.token_hash=? AND prt.expires_at>? AND prt.consumed_at IS NULL ORDER BY prt.id DESC LIMIT 1`).get(email, hash(token), now()) as DbRow | undefined;
    if (!reset) return fail(res, 400, 'INVALID_RESET_TOKEN', 'The reset token is invalid or expired.');
    const salt = randomBytes(16).toString('hex');
    db.prepare('UPDATE users SET password_salt=?, password_hash=? WHERE id=?').run(salt, passHash(password, salt), Number(reset.user_id));
    db.prepare('UPDATE password_reset_tokens SET consumed_at=? WHERE id=?').run(now(), Number(reset.id));
    return sendJson(res, 200, { message: 'Password updated successfully.' });
  }

  if (path === '/api/cart' && method === 'GET') {
    const user = requireUser(req, res); if (!user) return;
    const items = listCart(user.id);
    return sendJson(res, 200, { items, itemCount: items.reduce((n, i) => n + i.quantity, 0), subtotalCents: items.reduce((n, i) => n + i.lineTotalCents, 0) });
  }
  if (path === '/api/cart/items' && method === 'POST') {
    const user = requireUser(req, res); if (!user) return;
    const body = await readBody(req);
    const productId = String(body.productId || '');
    const quantity = Number(body.quantity || 1);
    const color = String(body.color || 'Natural Titanium').slice(0, 40);
    const storage = String(body.storage || '128GB').slice(0, 20);
    const product = db.prepare('SELECT id, stock FROM products WHERE id=?').get(productId) as DbRow | undefined;
    if (!product) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'Choose a valid product.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return fail(res, 400, 'VALIDATION_ERROR', 'Quantity must be between 1 and 20.');
    if (Number(product.stock) < quantity) return fail(res, 409, 'INSUFFICIENT_STOCK', 'There is not enough stock for that quantity.');
    db.prepare(`INSERT INTO cart_items (user_id, product_id, color, storage, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, product_id, color, storage) DO UPDATE SET quantity=MIN(cart_items.quantity + excluded.quantity, 20)`).run(user.id, productId, color, storage, quantity, now());
    return sendJson(res, 201, { items: listCart(user.id), message: 'Added to bag.' });
  }
  const cartItemMatch = path.match(/^\/api\/cart\/items\/(\d+)$/);
  if (cartItemMatch && method === 'PATCH') {
    const user = requireUser(req, res); if (!user) return;
    const body = await readBody(req); const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return fail(res, 400, 'VALIDATION_ERROR', 'Quantity must be between 1 and 20.');
    const result = db.prepare('UPDATE cart_items SET quantity=? WHERE id=? AND user_id=?').run(quantity, Number(cartItemMatch[1]), user.id);
    if (!Number(result.changes)) return fail(res, 404, 'CART_ITEM_NOT_FOUND', 'Cart item was not found.');
    return sendJson(res, 200, { items: listCart(user.id) });
  }
  if (cartItemMatch && method === 'DELETE') {
    const user = requireUser(req, res); if (!user) return;
    const result = db.prepare('DELETE FROM cart_items WHERE id=? AND user_id=?').run(Number(cartItemMatch[1]), user.id);
    if (!Number(result.changes)) return fail(res, 404, 'CART_ITEM_NOT_FOUND', 'Cart item was not found.');
    return sendJson(res, 200, { items: listCart(user.id), message: 'Item removed.' });
  }

  if (path === '/api/wishlist' && method === 'GET') {
    const user = requireUser(req, res); if (!user) return;
    const rows = db.prepare('SELECT p.* FROM wishlist_items w JOIN products p ON p.id=w.product_id WHERE w.user_id=? ORDER BY w.created_at DESC').all(user.id) as DbRow[];
    return sendJson(res, 200, { data: rows.map(asProduct) });
  }
  const wishlistMatch = path.match(/^\/api\/wishlist\/([a-zA-Z0-9-]+)$/);
  if (wishlistMatch && method === 'POST') {
    const user = requireUser(req, res); if (!user) return;
    const product = db.prepare('SELECT id FROM products WHERE id=?').get(wishlistMatch[1]);
    if (!product) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'No product exists with that id.');
    db.prepare('INSERT OR IGNORE INTO wishlist_items (user_id, product_id, created_at) VALUES (?, ?, ?)').run(user.id, wishlistMatch[1], now());
    return sendJson(res, 201, { message: 'Saved to wishlist.' });
  }
  if (wishlistMatch && method === 'DELETE') {
    const user = requireUser(req, res); if (!user) return;
    db.prepare('DELETE FROM wishlist_items WHERE user_id=? AND product_id=?').run(user.id, wishlistMatch[1]);
    return sendJson(res, 200, { message: 'Removed from wishlist.' });
  }

  if (path === '/api/orders' && method === 'GET') {
    const user = requireUser(req, res); if (!user) return;
    const rows = db.prepare('SELECT id FROM orders WHERE user_id=? ORDER BY created_at DESC').all(user.id) as DbRow[];
    return sendJson(res, 200, { data: rows.map((r) => orderWithItems(String(r.id), user.id)) });
  }
  if (path === '/api/orders' && method === 'POST') {
    const user = requireUser(req, res); if (!user) return;
    const body = await readBody(req);
    const shipping = isJsonObject(body.shipping) ? body.shipping : {};
    const requiredShipping = ['fullName', 'address', 'city', 'zip', 'country'];
    if (requiredShipping.some((key) => !String(shipping[key] || '').trim())) return fail(res, 400, 'VALIDATION_ERROR', 'Complete all required shipping fields.');
    const paymentMethod = String(body.paymentMethod || '');
    if (!['Credit Card', 'Orchard Pay', 'Pay on Delivery'].includes(paymentMethod)) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a supported payment method.');
    const items = listCart(user.id);
    if (!items.length) return fail(res, 409, 'CART_EMPTY', 'Add at least one product before placing an order.');
    for (const item of items) {
      const current = db.prepare('SELECT stock FROM products WHERE id=?').get(item.id) as { stock: number };
      if (!current || current.stock < item.quantity) return fail(res, 409, 'INSUFFICIENT_STOCK', `${item.name} does not have enough stock.`);
    }
    let id = orderId();
    while (db.prepare('SELECT id FROM orders WHERE id=?').get(id)) id = orderId();
    const createdAt = now(); const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO orders (id, user_id, total_cents, status, shipping_json, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, user.id, totalCents, 'Processing', JSON.stringify(shipping), paymentMethod, createdAt);
      const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, product_image, unit_price_cents, quantity, color, storage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const decrement = db.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?');
      for (const item of items) {
        insertItem.run(id, item.id, item.name, item.image, item.priceCents, item.quantity, item.color, item.storage);
        const changed = decrement.run(item.quantity, item.id, item.quantity);
        if (!Number(changed.changes)) throw new Error(`STOCK_RACE:${item.name}`);
      }
      db.prepare('DELETE FROM cart_items WHERE user_id=?').run(user.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      if (String((error as Error).message).startsWith('STOCK_RACE:')) return fail(res, 409, 'INSUFFICIENT_STOCK', 'Stock changed while placing your order. Please review your bag.');
      throw error;
    }
    return sendJson(res, 201, { order: orderWithItems(id, user.id), message: 'Order placed successfully.' });
  }
  const orderMatch = path.match(/^\/api\/orders\/(ORD-[A-Z0-9]{6})$/);
  if (orderMatch && method === 'GET') {
    const user = requireUser(req, res); if (!user) return;
    const order = orderWithItems(orderMatch[1], user.id);
    if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order was not found.');
    return sendJson(res, 200, { order });
  }
  const orderStatusMatch = path.match(/^\/api\/orders\/(ORD-[A-Z0-9]{6})\/status$/);
  if (orderStatusMatch && method === 'PATCH') {
    const user = requireUser(req, res); if (!user) return;
    const order = orderWithItems(orderStatusMatch[1], user.id);
    if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order was not found.');
    const next: Record<string, string> = { Processing: 'Shipped', Shipped: 'Delivered' };
    const newStatus = next[order.status];
    if (!newStatus) return fail(res, 409, 'INVALID_TRANSITION', `An order in ${order.status} status cannot advance further.`);
    db.prepare('UPDATE orders SET status=? WHERE id=? AND user_id=?').run(newStatus, order.id, user.id);
    return sendJson(res, 200, { order: orderWithItems(order.id, user.id), message: `Order advanced to ${newStatus}.` });
  }
  const cancelMatch = path.match(/^\/api\/orders\/(ORD-[A-Z0-9]{6})\/cancel$/);
  if (cancelMatch && method === 'POST') {
    const user = requireUser(req, res); if (!user) return;
    const order = orderWithItems(cancelMatch[1], user.id);
    if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order was not found.');
    if (order.status !== 'Processing') return fail(res, 409, 'ORDER_NOT_CANCELLABLE', 'Only processing orders can be cancelled.');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of order.items) db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(item.quantity, item.productId);
      db.prepare("UPDATE orders SET status='Cancelled' WHERE id=? AND user_id=?").run(order.id, user.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return sendJson(res, 200, { order: orderWithItems(order.id, user.id), message: 'Order cancelled.' });
  }

  if (path === '/api/returns' && method === 'GET') {
    const user = requireUser(req, res); if (!user) return;
    const data = db.prepare('SELECT id, order_id AS orderId, reason, details, status, created_at AS createdAt FROM return_requests WHERE user_id=? ORDER BY created_at DESC').all(user.id);
    return sendJson(res, 200, { data });
  }
  if (path === '/api/returns' && method === 'POST') {
    const user = requireUser(req, res); if (!user) return;
    const body = await readBody(req); const orderIdValue = String(body.orderId || '').trim();
    const reason = String(body.reason || '').trim(); const details = String(body.details || '').trim().slice(0, 2000);
    if (!orderIdValue || !reason) return fail(res, 400, 'VALIDATION_ERROR', 'Order ID and a return reason are required.');
    const order = orderWithItems(orderIdValue, user.id);
    if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order was not found for this account.');
    if (order.status === 'Cancelled') return fail(res, 409, 'ORDER_NOT_RETURNABLE', 'Cancelled orders cannot be returned.');
    const id = returnId();
    db.prepare('INSERT INTO return_requests (id, user_id, order_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, user.id, order.id, reason, details, 'Requested', now());
    return sendJson(res, 201, { returnRequest: { id, orderId: order.id, reason, details, status: 'Requested' }, message: 'Return request submitted.' });
  }

  if (path === '/api/support' && method === 'POST') {
    const body = await readBody(req); const user = getUser(req);
    const name = String(body.name || user?.name || '').trim(); const email = String(body.email || user?.email || '').trim().toLowerCase();
    const orderIdValue = String(body.orderId || '').trim(); const message = String(body.message || '').trim();
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || message.length < 8) return fail(res, 400, 'VALIDATION_ERROR', 'Provide a name of at least 2 characters, a valid email, and a message of at least 8 characters.');
    if (orderIdValue && !/^ORD-[A-Z0-9]{6}$/.test(orderIdValue)) return fail(res, 400, 'VALIDATION_ERROR', 'Order ID format should look like ORD-ABC123.');
    const id = ticketId();
    db.prepare('INSERT INTO support_tickets (id, user_id, name, email, order_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, user?.id || null, name, email, orderIdValue, message, 'Open', now());
    return sendJson(res, 201, { ticket: { id, status: 'Open' }, message: 'Support request received.' });
  }

  return fail(res, 404, 'NOT_FOUND', `No API route for ${method} ${path}.`);
}

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' };
async function handleStatic(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET and HEAD are supported for static content.');
  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath === '/' || !extname(requestPath)) requestPath = '/index.html';
  const safePath = normalize(requestPath).replace(/^([/\\]|\.\.(?:[/\\]|$))+/, '');
  const filePath = resolve(PUBLIC_DIR, safePath);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + sep)) return fail(res, 403, 'FORBIDDEN', 'Path is not allowed.');
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    const content = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream', 'content-length': content.length, 'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600' });
    if (req.method === 'HEAD') res.end(); else res.end(content);
  } catch {
    return fail(res, 404, 'NOT_FOUND', `Static asset not found: ${url.pathname}`);
  }
}

const server = createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  void (async () => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await handleStatic(req, res, url);
  })().catch((error: unknown) => {
    const status = Number(errorProperty(error, 'status')) || 500;
    const code = String(errorProperty(error, 'code') || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'));
    const message = error instanceof Error ? error.message : String(error);
    if (!res.headersSent) sendJson(res, status, { error: code, message: status === 500 ? 'Unexpected server error. Check the terminal logs.' : message || 'Request failed.' });
    else res.destroy();
    if (status === 500) console.error('[orchard-api]', error);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🍏 Orchard Quality Lab ready`);
  console.log(`   Main URL:  http://127.0.0.1:${PORT}`);
  console.log(`   API root:  http://127.0.0.1:${PORT}/api`);
  console.log(`   DB file:   ${DB_FILE}`);
  console.log(`   QA mode:   ${QA_MODE ? 'enabled (local practice)' : 'disabled'}\n`);
});

function shutdown() {
  server.close(() => {
    db.close();
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

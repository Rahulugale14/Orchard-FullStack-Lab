import { test, expect } from '../../fixtures/test.js';
import { signUpThroughApi, uniqueEmail } from '../../utils/helpers.js';

test.describe('Orchard Quality Lab — REST API', () => {
  test('API-01: health endpoint verifies application and SQLite connectivity', async ({
    request,
  }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'ok',
      service: 'orchard-quality-lab',
      database: 'connected',
    });
  });

  test('API-02: product search, category filter, pagination, and detail endpoint', async ({
    request,
  }) => {
    const list = await request.get(
      '/api/products?q=Orchard%20Phone&category=phones&limit=1&page=1',
    );
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBeGreaterThanOrEqual(2);
    expect(body.pagination.totalPages).toBeGreaterThanOrEqual(2);
    const detail = await request.get('/api/products/phone-15-pro');
    expect((await detail.json()).data).toMatchObject({ id: 'phone-15-pro', sku: 'OR-P15P' });
    expect((await request.get('/api/products/not-a-product')).status()).toBe(404);
  });

  test('API-03: signup validation rejects invalid input and duplicate emails', async ({
    request,
    authApi,
  }) => {
    const invalid = await request.post('/api/auth/signup', {
      data: {
        firstName: 'A',
        lastName: 'B',
        email: 'not-an-email',
        password: 'short',
        acceptTerms: false,
      },
    });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).error).toBe('VALIDATION_ERROR');
    const email = uniqueEmail('duplicate');
    const signup = {
      firstName: 'API',
      lastName: 'Tester',
      email,
      password: 'Practice123!',
      acceptTerms: true as const,
    };
    expect((await authApi.signUp(signup)).status()).toBe(201);
    const duplicate = await authApi.signUp(signup);
    expect(duplicate.status()).toBe(409);
  });

  test('API-04: protected cart and order endpoints require authentication', async ({ request }) => {
    expect((await request.get('/api/cart')).status()).toBe(401);
    expect((await request.get('/api/orders')).status()).toBe(401);
    expect((await request.get('/api/wishlist')).status()).toBe(401);
  });

  test('API-05: complete authenticated cart-to-order-to-return lifecycle', async ({
    request,
    apiClient,
  }) => {
    const email = uniqueEmail('lifecycle');
    const created = await signUpThroughApi(request, email);
    expect(created.user.email).toBe(email);
    const add = await apiClient.addCartItem({
      productId: 'phone-15-pro',
      quantity: 2,
      color: 'Natural Titanium',
      storage: '256GB',
    });
    expect(add.status()).toBe(201);
    expect((await add.json()).items[0].quantity).toBe(2);
    const cart = await apiClient.getCart();
    expect((await cart.json()).subtotalCents).toBe(199800);
    const placed = await apiClient.createOrder({
      shipping: {
        fullName: 'API Tester',
        address: '123 Test Street',
        city: 'Nashik',
        zip: '422001',
        country: 'in',
      },
      paymentMethod: 'Orchard Pay',
    });
    expect(placed.status()).toBe(201);
    const order = (await placed.json()).order;
    expect(order.id).toMatch(/^ORD-[A-F0-9]{6}$/);
    expect(order.totalCents).toBe(199800);
    expect(order.items[0].quantity).toBe(2);
    expect((await request.get('/api/cart')).status()).toBe(200);
    expect((await (await request.get('/api/cart')).json()).items).toHaveLength(0);
    const shipped = await apiClient.advanceOrder(order.id);
    expect((await shipped.json()).order.status).toBe('Shipped');
    const delivered = await apiClient.advanceOrder(order.id);
    expect((await delivered.json()).order.status).toBe('Delivered');
    expect((await request.patch(`/api/orders/${order.id}/status`, { data: {} })).status()).toBe(
      409,
    );
    const returned = await apiClient.createReturn({
      orderId: order.id,
      reason: 'Automation lifecycle validation',
      details: 'Return record must be persisted.',
    });
    expect(returned.status()).toBe(201);
    const returns = await request.get('/api/returns');
    expect(
      (await returns.json()).data.some((r: { orderId: string }) => r.orderId === order.id),
    ).toBeTruthy();
  });

  test('API-06: wishlist and support endpoints persist expected records', async ({ request }) => {
    const { user, email } = await signUpThroughApi(request);
    const save = await request.post('/api/wishlist/phone-15-pro', { data: {} });
    expect(save.status()).toBe(201);
    expect((await request.get('/api/wishlist')).status()).toBe(200);
    const support = await request.post('/api/support', {
      data: {
        name: user.name,
        email,
        message: 'Validate support ticket API contract and persistence.',
      },
    });
    expect(support.status()).toBe(201);
    expect((await support.json()).ticket.id).toMatch(/^SUP-[A-F0-9]{6}$/);
  });

  test('API-07: OpenAPI contract is served from the same website origin', async ({ request }) => {
    const response = await request.get('/openapi.json');
    expect(response.status()).toBe(200);
    const contract = await response.json();
    expect(contract.openapi).toBe('3.1.0');
    expect(contract.info.title).toBe('Orchard Quality Lab API');
    expect(contract.paths['/api/orders'].post).toBeTruthy();
    expect(contract.paths['/api/qa/db-summary'].get).toBeTruthy();
    expect(contract.components.schemas.Product.properties.priceCents.type).toBe('integer');
  });
});

import { test, expect } from '../../fixtures/test.js';
import { createOrderThroughUi, signUpThroughUi, uniqueEmail } from '../../utils/helpers.js';

test.describe('Orchard Quality Lab — UI workflows (10 TCs)', () => {
  test('UI-01: homepage, catalog, and live service status render', async ({
    page,
    catalogPage,
  }) => {
    await catalogPage.open();
    await expect(page.getByRole('heading', { name: /Good design\./ })).toBeVisible();
    await expect(page.getByTestId('product-grid')).toBeVisible();
    await expect(page.getByTestId('product-card-phone-15-pro')).toBeVisible();
    await expect(page.locator('#apiHealth')).toContainText('API + DB online');
    await expect(page.locator('#catalogCount')).toHaveText('08');
  });

  test('UI-02: product search filters results from the backend', async ({ page, catalogPage }) => {
    await catalogPage.open();
    await catalogPage.search('Orchard Phone 15 Pro');
    await expect(page.getByTestId('product-card-phone-15-pro')).toBeVisible();
    await expect(page.locator('#productGrid .product-card')).toHaveCount(1);
    await expect(page.getByTestId('product-name-phone-15-pro')).toContainText(
      'Orchard Phone 15 Pro',
    );
  });

  test('UI-03: category filtering and price sorting operate on real catalog data', async ({
    page,
    catalogPage,
  }) => {
    await catalogPage.open();
    await catalogPage.selectCategory('Audio');
    await expect(page.locator('#productGrid .product-card')).toHaveCount(1);
    await expect(page.getByTestId('product-card-buds-pro')).toBeVisible();
    await catalogPage.selectCategory('All items');
    await catalogPage.sortBy('price-asc');
    const firstProduct = page.locator('#productGrid .product-card').first();
    await expect(firstProduct).toContainText('35W USB-C Power Adapter');
  });

  test('UI-04: customer can create an account and persist a wishlist item', async ({ page }) => {
    await signUpThroughUi(page);
    await page.getByRole('button', { name: /Add to wishlist: Orchard Phone 15 Pro/ }).click();
    await expect(
      page.getByRole('button', { name: /Remove from wishlist: Orchard Phone 15 Pro/ }),
    ).toBeVisible();
    const response = await page.request.get('/api/wishlist');
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.data.some((product: { id: string }) => product.id === 'phone-15-pro')).toBeTruthy();
  });

  test('UI-05: existing demo account can sign in', async ({ page, authPage }) => {
    await authPage.signIn('test14@gmail.com', 'Test1454test');
    await expect(page.locator('#accountLabel')).toContainText('Demo');
    const response = await page.request.get('/api/auth/me');
    expect(response.status()).toBe(200);
  });

  test('UI-06: complete checkout creates an order and clears the cart', async ({ page }) => {
    const orderId = await createOrderThroughUi(page);
    await expect(page.getByTestId(`order-card-${orderId}`)).toBeVisible();
    await expect(page.getByTestId(`order-card-${orderId}`)).toContainText('Processing');
    await expect(page.getByTestId(`order-card-${orderId}`)).toContainText('$1,248.00');
    await expect(page.getByTestId(`order-card-${orderId}`)).toContainText('Orchard Buds Pro');
    const cart = await page.request.get('/api/cart');
    expect((await cart.json()).items).toHaveLength(0);
  });

  test('UI-07: order status transitions Processing → Shipped → Delivered', async ({ page }) => {
    const orderId = await createOrderThroughUi(page);
    const status = page.getByTestId(`order-status-${orderId}`);
    await expect(status).toContainText('Processing');
    await page
      .getByTestId(`order-card-${orderId}`)
      .getByRole('button', { name: /Simulate next status/ })
      .click();
    await expect(status).toContainText('Shipped');
    await page
      .getByTestId(`order-card-${orderId}`)
      .getByRole('button', { name: /Simulate next status/ })
      .click();
    await expect(status).toContainText('Delivered');
  });

  test('UI-08: user submits a return request for a persisted order', async ({ page }) => {
    const orderId = await createOrderThroughUi(page);
    await page
      .getByTestId(`order-card-${orderId}`)
      .getByRole('button', { name: /Request return/ })
      .click();
    await page.getByLabel('Reason').selectOption({ label: 'Item arrived damaged' });
    await page
      .locator('#returnDetails')
      .fill('Practice return: checking persistence of the request record.');
    await page.getByRole('button', { name: /Submit return request/ }).click();
    await expect(page.locator('#returnMessage')).toContainText('submitted');
    await expect(page.locator('#returnsPanel')).toContainText('Item arrived damaged');
  });

  test('UI-09: support form creates a support ticket with an ID', async ({ page }) => {
    await page.goto('/#support');
    const supportForm = page.locator('#supportForm');
    await expect(page.getByTestId('support-view')).toBeVisible();
    await supportForm.getByLabel('Full name').fill('Playwright Support Tester');
    await supportForm.getByLabel('Email address').fill(uniqueEmail('support'));
    await supportForm
      .getByLabel(/How can we help/)
      .fill('Validating support API and database persistence from the UI.');
    await page.getByRole('button', { name: /Submit support ticket/ }).click();
    await expect(page.locator('#supportResult')).toContainText('Ticket ID: SUP-');
  });

  test('UI-10: password reset uses a demo token and accepts the new password', async ({ page }) => {
    const email = uniqueEmail('reset');
    await signUpThroughUi(page, email);
    await page.evaluate(async () => {
      await fetch('/api/auth/signout', { method: 'POST' });
    });
    await page.reload();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.locator('#forgotEmail').fill(email);
    await page.getByRole('button', { name: /Prepare reset token/ }).click();
    await expect(page.locator('#resetForm')).toBeVisible();
    await expect(page.locator('#resetToken')).not.toBeEmpty();
    await page.locator('#resetNewPassword').fill('FreshPassword123!');
    await page.getByRole('button', { name: /Reset password/ }).click();
    await expect(page.locator('#resetMessage')).toContainText('Password updated successfully');
    await page.getByRole('button', { name: /Back to sign in/ }).click();
    await page.getByTestId('signin-email-input').fill(email);
    await page.getByTestId('signin-password-input').fill('FreshPassword123!');
    await page.getByTestId('signin-submit-btn').click();
    await expect(page.locator('#accountLabel')).toContainText('Playwright');
  });
});

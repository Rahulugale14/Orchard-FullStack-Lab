import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { AuthApiClient } from '../api/clients/auth.client.js';
import { AuthPage } from '../ui/pages/auth.page.js';
import { CatalogPage } from '../ui/pages/catalog.page.js';
import { CheckoutPage } from '../ui/pages/checkout.page.js';

export const uniqueEmail = (prefix = 'pw') =>
  `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;

export async function signUpThroughUi(page: Page, email = uniqueEmail('ui')) {
  await new AuthPage(page).signUp({
    firstName: 'Playwright',
    lastName: 'Tester',
    email,
    password: 'Practice123!',
  });
  await expect(page.locator('#accountLabel')).toContainText('Playwright');
  return email;
}

export async function signUpThroughApi(request: APIRequestContext, email = uniqueEmail('api')) {
  const json = await new AuthApiClient(request).signUpWithUser({
    firstName: 'API',
    lastName: 'Tester',
    email,
    password: 'Practice123!',
    acceptTerms: true,
  });
  return { email, user: json.user };
}

export async function createOrderThroughUi(page: Page) {
  await signUpThroughUi(page);
  const catalog = new CatalogPage(page);
  await catalog.addToBag('phone-15-pro');
  await catalog.addToBag('buds-pro');
  await catalog.openBag();
  await expect(page.locator('#cartSubtotal')).toHaveText('$1,248.00');
  await expect(page.locator('#checkoutTotal')).toHaveText('$1,248.00');
  await new CheckoutPage(page).placePracticeOrder();
  const firstOrder = page.locator('[data-testid^="order-card-"]').first();
  await expect(firstOrder).toBeVisible();
  const orderId = await firstOrder.locator('.order-id-label strong').first().innerText();
  expect(orderId).toMatch(/^ORD-[A-F0-9]{6}$/);
  return orderId;
}

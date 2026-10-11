import { test, expect } from '../../fixtures/test.js';
import { uniqueEmail } from '../../utils/helpers.js';

const catalogSearchCases = [
  { query: 'Orchard Buds Pro', productId: 'buds-pro', productName: 'Orchard Buds Pro' },
  {
    query: 'Orchard Watch Series 9',
    productId: 'watch-series-9',
    productName: 'Orchard Watch Series 9',
  },
  { query: 'Orchard Tab Air', productId: 'tablet-air', productName: 'Orchard Tab Air' },
  { query: 'Clear Protective Case', productId: 'clear-case', productName: 'Clear Protective Case' },
];

const signupCases = [
  { firstName: 'Avery', lastName: 'Morgan' },
  { firstName: 'Jordan', lastName: 'Patel' },
  { firstName: 'Riley', lastName: 'Chen' },
];

const supportCases = [
  {
    name: 'Taylor Brooks',
    message: 'I have a question about product availability.',
  },
  {
    name: 'Casey Rivera',
    message: 'Please help me understand the return process.',
  },
  {
    name: 'Morgan Ellis',
    message: 'I would like more information about an order.',
  },
];

test.describe('Orchard Quality Lab — data-driven UI workflows', () => {
  for (const { query, productId, productName } of catalogSearchCases) {
    test(`search finds ${productName}`, async ({ page, catalogPage }) => {
      await catalogPage.open();
      await catalogPage.search(query);
      await expect(page.getByTestId(`product-card-${productId}`)).toBeVisible();
      await expect(page.locator('#productGrid .product-card')).toHaveCount(1);
      await expect(page.getByTestId(`product-name-${productId}`)).toHaveText(productName);
    });
  }

  for (const { firstName, lastName } of signupCases) {
    test(`sign up accepts a unique email for ${firstName} ${lastName}`, async ({
      page,
      authPage,
    }) => {
      const email = uniqueEmail('ui-data');
      await authPage.signUp({
        firstName,
        lastName,
        email,
        password: 'Practice123!',
      });
      await expect(page.locator('#accountLabel')).toContainText(firstName);

      const response = await page.request.get('/api/auth/me');
      expect(response.ok()).toBeTruthy();
      const user = (await response.json()).user;
      expect(user.email).toBe(email);
      expect(user.name).toBe(`${firstName} ${lastName}`);
    });
  }

  for (const { name, message } of supportCases) {
    test(`support accepts a unique email for ${name}`, async ({ page }) => {
      const email = uniqueEmail('ui-support');
      await page.goto('/#support');
      const supportForm = page.locator('#supportForm');
      await supportForm.getByLabel('Full name').fill(name);
      await supportForm.getByLabel('Email address').fill(email);
      await supportForm.getByLabel(/How can we help/).fill(message);
      await page.getByRole('button', { name: /Submit support ticket/ }).click();

      await expect(page.locator('#supportResult')).toContainText('Ticket ID: SUP-');
      await expect(page.locator('#supportResult')).toContainText('Status: Open');
    });
  }
});

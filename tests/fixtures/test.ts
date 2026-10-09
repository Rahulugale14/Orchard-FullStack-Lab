import { test as base } from '@playwright/test';
import { AuthApiClient } from '../api/clients/auth.client.js';
import { OrchardApiClient } from '../api/clients/orchard-api.client.js';
import { AuthPage } from '../ui/pages/auth.page.js';
import { CatalogPage } from '../ui/pages/catalog.page.js';
import { CheckoutPage } from '../ui/pages/checkout.page.js';

interface Fixtures {
  authApi: AuthApiClient;
  apiClient: OrchardApiClient;
  authPage: AuthPage;
  catalogPage: CatalogPage;
  checkoutPage: CheckoutPage;
}

export const test = base.extend<Fixtures>({
  authApi: async ({ request }, use) => use(new AuthApiClient(request)),
  apiClient: async ({ request }, use) => use(new OrchardApiClient(request)),
  authPage: async ({ page }, use) => use(new AuthPage(page)),
  catalogPage: async ({ page }, use) => use(new CatalogPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
});

export { expect } from '@playwright/test';

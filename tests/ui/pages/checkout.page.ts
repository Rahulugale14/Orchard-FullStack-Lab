import type { Page } from '@playwright/test';

export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async placePracticeOrder(): Promise<void> {
    await this.page.getByRole('button', { name: /Continue to checkout/ }).click();
    await this.page.getByTestId('ship-address').fill('123 Practice Street');
    await this.page.getByTestId('ship-city').fill('Nashik');
    await this.page.getByTestId('ship-zip').fill('422001');
    await this.page.getByTestId('ship-country').selectOption('in');
    await this.page.getByTestId('place-order-btn').click();
  }
}

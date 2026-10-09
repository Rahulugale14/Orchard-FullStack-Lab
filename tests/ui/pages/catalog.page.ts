import type { Page } from '@playwright/test';

export class CatalogPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/');
    await this.page.getByTestId('product-grid').waitFor();
  }

  async search(query: string): Promise<void> {
    await this.page.getByTestId('product-search-input').fill(query);
  }

  async selectCategory(name: string): Promise<void> {
    await this.page.getByRole('button', { name, exact: true }).click();
  }

  async sortBy(value: 'featured' | 'price-asc' | 'price-desc' | 'name'): Promise<void> {
    await this.page.getByLabel('Sort products').selectOption(value);
  }

  async addToBag(productId: string): Promise<void> {
    await this.page.getByTestId(`add-to-bag-${productId}`).click();
  }

  async openBag(): Promise<void> {
    await this.page.getByRole('button', { name: /Open shopping bag/ }).click();
  }
}

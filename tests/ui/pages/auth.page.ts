import type { Page } from '@playwright/test';

export interface SignUpForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export class AuthPage {
  constructor(private readonly page: Page) {}

  async openSignUp(): Promise<void> {
    await this.page.goto('/');
    await this.page.getByTestId('product-card-phone-15-pro').waitFor();
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.getByTestId('signup-tab').click();
  }

  async signUp(form: SignUpForm): Promise<void> {
    await this.openSignUp();
    await this.page.getByTestId('signup-firstname-input').fill(form.firstName);
    await this.page.getByTestId('signup-lastname-input').fill(form.lastName);
    await this.page.getByTestId('signup-email-input').fill(form.email);
    await this.page.getByTestId('signup-password-input').fill(form.password);
    await this.page.getByTestId('signup-accept-terms').check();
    await this.page.getByTestId('signup-submit-btn').click();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.page.goto('/');
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.getByTestId('signin-email-input').fill(email);
    await this.page.getByTestId('signin-password-input').fill(password);
    await this.page.getByTestId('signin-submit-btn').click();
  }
}

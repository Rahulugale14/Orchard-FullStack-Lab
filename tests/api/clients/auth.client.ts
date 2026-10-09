import type { APIRequestContext, APIResponse } from '@playwright/test';
import { apiPaths, type SignUpRequest, type SignUpResponse } from './api-paths.js';

export class AuthApiClient {
  constructor(private readonly request: APIRequestContext) {}

  signUp(data: SignUpRequest): Promise<APIResponse> {
    return this.request.post(apiPaths.signUp, { data });
  }

  async signUpWithUser(data: SignUpRequest): Promise<SignUpResponse> {
    const response = await this.signUp(data);
    if (response.status() !== 201) {
      throw new Error(`Signup failed with HTTP ${response.status()}: ${await response.text()}`);
    }
    return response.json() as Promise<SignUpResponse>;
  }
}

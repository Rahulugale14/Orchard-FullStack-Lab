import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  apiPaths,
  type AddCartItemRequest,
  type CreateOrderRequest,
  type CreateReturnRequest,
  type CreateSupportTicketRequest,
} from './api-paths.js';

export class OrchardApiClient {
  constructor(private readonly request: APIRequestContext) {}

  health(): Promise<APIResponse> {
    return this.request.get(apiPaths.health);
  }

  listProducts(query = ''): Promise<APIResponse> {
    return this.request.get(`${apiPaths.products}${query}`);
  }

  getProduct(productId: string): Promise<APIResponse> {
    return this.request.get(`${apiPaths.products}/${encodeURIComponent(productId)}`);
  }

  getCart(): Promise<APIResponse> {
    return this.request.get(apiPaths.cart);
  }

  addCartItem(data: AddCartItemRequest): Promise<APIResponse> {
    return this.request.post(apiPaths.cartItems, { data });
  }

  createOrder(data: CreateOrderRequest): Promise<APIResponse> {
    return this.request.post(apiPaths.orders, { data });
  }

  advanceOrder(orderId: string): Promise<APIResponse> {
    return this.request.patch(`${apiPaths.orders}/${encodeURIComponent(orderId)}/status`, {
      data: {},
    });
  }

  createReturn(data: CreateReturnRequest): Promise<APIResponse> {
    return this.request.post(apiPaths.returns, { data });
  }

  createSupportTicket(data: CreateSupportTicketRequest): Promise<APIResponse> {
    return this.request.post(apiPaths.support, { data });
  }
}

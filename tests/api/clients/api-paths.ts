export const apiPaths = {
  health: '/api/health',
  products: '/api/products',
  signUp: '/api/auth/signup',
  cart: '/api/cart',
  cartItems: '/api/cart/items',
  orders: '/api/orders',
  returns: '/api/returns',
  support: '/api/support',
} as const;

export interface SignUpRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  acceptTerms: true;
}

export interface UserResponse {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface SignUpResponse {
  user: UserResponse;
  message: string;
}

export interface AddCartItemRequest {
  productId: string;
  quantity: number;
  color: string;
  storage: string;
}

export interface ShippingAddress {
  fullName: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}

export interface CreateOrderRequest {
  shipping: ShippingAddress;
  paymentMethod: string;
}

export interface CreateReturnRequest {
  orderId: string;
  reason: string;
  details: string;
}

export interface CreateSupportTicketRequest {
  name: string;
  email: string;
  message: string;
  orderId?: string;
}

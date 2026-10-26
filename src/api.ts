import * as SecureStore from 'expo-secure-store';

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8082').replace(/\/$/, '');
const TOKEN_KEY = 'scancode_token';
const payoutKey = (storefrontId: number) => `scancode_payout_${storefrontId}`;

// ─── Token helpers ───────────────────────────────────────────────────────────

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveActivePayoutId(storefrontId: number, payoutId: number): Promise<void> {
  await SecureStore.setItemAsync(payoutKey(storefrontId), String(payoutId));
}

export async function getActivePayoutId(storefrontId: number): Promise<number | null> {
  const value = await SecureStore.getItemAsync(payoutKey(storefrontId));
  if (value === null) return null;
  const payoutId = Number(value);
  return Number.isSafeInteger(payoutId) && payoutId > 0 ? payoutId : null;
}

export async function clearActivePayoutId(storefrontId: number): Promise<void> {
  await SecureStore.deleteItemAsync(payoutKey(storefrontId));
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  requireAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `Cannot reach ScanCode at ${API_BASE}. Set EXPO_PUBLIC_API_URL to a server address reachable from this device.`,
      );
    }
    throw err;
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.message ?? err.error ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  roles: string[];
  isPaid: boolean;
}

export interface MeResponse {
  id: number;
  username: string;
  email: string;
  roles: string[];
  isPaid: boolean;
}

export interface StorefrontResponse {
  id: number;
  userId: number;
  businessType: string;
  slug: string;
  publicUrl: string;
  name: string;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  data: unknown;
  active: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInitResponse {
  authorizationUrl: string;
  reference: string;
}

export interface PaymentVerifyResponse {
  verified: boolean;
  createdSlug: string | null;
}

export interface StoreOrder {
  id: number;
  storefrontId: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  orderItems: string;
  subtotal: number;
  vat: number;
  delivery: number;
  total: number;
  tableCode: string | null;
  tableLabel: string | null;
  status: string;
  paymentStatus: string;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreRequest {
  id: number;
  storefrontId: number;
  requestType: string;
  details: string;
  amount: number;
  paymentStatus: string;
  paymentReference: string | null;
  status: string;
  createdAt: string;
}

export interface StoreTip {
  id: number;
  storefrontId: number;
  recipient: string;
  customRecipient: string | null;
  amount: number;
  paymentStatus: string;
  paymentReference: string | null;
  status: string;
  createdAt: string;
}

export interface WalletResponse {
  storefrontId: number;
  availableBalanceKobo: number;
  pendingBalanceKobo: number;
  bankCode: string | null;
  bankName: string | null;
  accountName: string | null;
  accountLast4: string | null;
  payoutsEnabled: boolean;
}

export interface Bank {
  code: string;
  name: string;
}

export interface WithdrawalResponse {
  id: number;
  reference: string;
  amountKobo: number;
  transferFeeKobo: number;
  status: 'PENDING' | 'OTP_REQUIRED' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  createdAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function login(email: string, password: string, rememberMe = false) {
  return request<AuthResponse>('POST', '/api/auth/login', { email, password, rememberMe }, false);
}

export function register(username: string, email: string, password: string) {
  return request<AuthResponse>('POST', '/api/auth/register', { username, email, password }, false);
}

export function getMe() {
  return request<MeResponse>('GET', '/api/auth/me');
}

// ─── Storefronts ─────────────────────────────────────────────────────────────

export interface CreateStorefrontBody {
  businessType: string;
  name: string;
  description: string;
  logoUrl?: string;
  bannerUrl?: string;
  data?: unknown;
}

export function createStorefront(body: CreateStorefrontBody) {
  return request<StorefrontResponse>('POST', '/api/business/storefronts', body);
}

export function getMyStorefronts() {
  return request<StorefrontResponse[]>('GET', '/api/business/storefronts/my');
}

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentPurpose = 'STOREFRONT_CREATION' | 'EVENT_CREATION';

export function initializePayment(purpose: PaymentPurpose, slug: string) {
  return request<PaymentInitResponse>('POST', '/api/payments/initialize', {
    purpose,
    payload: JSON.stringify({ slug }),
  });
}

export function verifyPayment(reference: string) {
  return request<PaymentVerifyResponse>('POST', '/api/payments/verify', { reference });
}

// ─── Storefront sales and wallet ─────────────────────────────────────────────

function storefrontPath(storefrontId: number) {
  return `/api/storefronts/${storefrontId}`;
}

export function getStoreOrders(storefrontId: number) {
  return request<StoreOrder[]>('GET', `${storefrontPath(storefrontId)}/orders`);
}

export function updateStoreOrderStatus(
  storefrontId: number,
  orderId: number,
  status: 'CONFIRMED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED',
) {
  return request<StoreOrder>(
    'PATCH',
    `${storefrontPath(storefrontId)}/orders/${orderId}/status`,
    { status },
  );
}

export function getStoreRequests(storefrontId: number) {
  return request<StoreRequest[]>('GET', `${storefrontPath(storefrontId)}/requests`);
}

export function acknowledgeStoreRequest(storefrontId: number, requestId: number) {
  return request<StoreRequest>(
    'PATCH',
    `${storefrontPath(storefrontId)}/requests/${requestId}/acknowledge`,
  );
}

export function rejectStoreRequest(storefrontId: number, requestId: number) {
  return request<StoreRequest>(
    'POST',
    `${storefrontPath(storefrontId)}/requests/${requestId}/reject`,
  );
}

export function getStoreTips(storefrontId: number) {
  return request<StoreTip[]>('GET', `${storefrontPath(storefrontId)}/tips`);
}

export function acknowledgeStoreTip(storefrontId: number, tipId: number) {
  return request<StoreTip>(
    'PATCH',
    `${storefrontPath(storefrontId)}/tips/${tipId}/acknowledge`,
  );
}

export function getWallet(storefrontId: number) {
  return request<WalletResponse>('GET', `${storefrontPath(storefrontId)}/wallet`);
}

export function getBanks(storefrontId: number) {
  return request<Bank[]>('GET', `${storefrontPath(storefrontId)}/wallet/banks`);
}

export function saveBankAccount(
  storefrontId: number,
  accountNumber: string,
  bankCode: string,
) {
  return request<WalletResponse>(
    'PUT',
    `${storefrontPath(storefrontId)}/wallet/bank-account`,
    { accountNumber, bankCode },
  );
}

export function requestWithdrawal(storefrontId: number, amountKobo: number) {
  return request<WithdrawalResponse>(
    'POST',
    `${storefrontPath(storefrontId)}/wallet/withdrawals`,
    { amountKobo },
  );
}

export function submitWithdrawalOtp(
  storefrontId: number,
  payoutId: number,
  otp: string,
) {
  return request<WithdrawalResponse>(
    'POST',
    `${storefrontPath(storefrontId)}/wallet/withdrawals/${payoutId}/otp`,
    { otp },
  );
}

export function refreshWithdrawal(storefrontId: number, payoutId: number) {
  return request<WithdrawalResponse>(
    'POST',
    `${storefrontPath(storefrontId)}/wallet/withdrawals/${payoutId}/refresh`,
  );
}

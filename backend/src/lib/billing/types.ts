import type { TenantPlan } from '@prisma/client';

export type BillingCycle = 'monthly' | 'yearly';
/** Only real plans can be bought — TRIAL is granted, never charged for. */
export type PaidPlan = Exclude<TenantPlan, 'TRIAL'>;

export interface CheckoutRequest {
  tenantId: string;
  tenantName: string;
  email: string | null;
  plan: PaidPlan;
  cycle: BillingCycle;
  /** Agorot. Money is only ever an integer in this codebase. */
  amount: number;
  /** Signed value the provider echoes back, binding its callback to this intent. */
  ref: string;
  successUrl: string;
  failureUrl: string;
  webhookUrl: string;
}

/**
 * A charge the provider has confirmed to US, server-to-server. Never built from a
 * callback body — only from a response we fetched ourselves.
 */
export interface SettledPayment {
  /** Provider's transaction id. Our idempotency key. */
  providerRef: string;
  /** Agorot actually captured, which is what we verify against the plan price. */
  amount: number;
  /** The `ref` we sent at checkout, echoed back. Null for renewals we initiated. */
  ref: string | null;
  /** Recurring-charge handle to store for renewals, when the provider issued one. */
  token: string | null;
  /** Provider-hosted tax invoice, when it issues one. */
  invoiceUrl: string | null;
  raw: unknown;
}

/**
 * What a payment provider must do for us. Everything provider-shaped — endpoints,
 * field names, response codes — lives behind this interface, so swapping or adding
 * a provider is one new file plus a registry line.
 */
export interface BillingProvider {
  id: string;
  /** False when credentials are missing; checkout then fails loudly instead of half-working. */
  configured(): boolean;
  /** Create a hosted payment page and return where to send the customer. */
  createCheckout(req: CheckoutRequest): Promise<{ redirectUrl: string }>;
  /**
   * Turn a raw provider callback into a verified payment, by re-querying the
   * provider. Returns null when the transaction did not actually succeed.
   */
  settle(callbackBody: unknown): Promise<SettledPayment | null>;
  /** Charge a stored token for a renewal. Null when the charge was declined. */
  chargeToken(args: { token: string; amount: number; description: string; email: string | null; tenantName: string }): Promise<SettledPayment | null>;
}

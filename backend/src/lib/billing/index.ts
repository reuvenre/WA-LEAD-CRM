// Subscription engine: prices, billing periods, and the state machine that turns a
// settled payment into paid access — provider-agnostic. Anything that knows what
// Cardcom's JSON looks like lives in ./cardcom.
//
// The money rule throughout: agorot as integers. No floats, ever.

import crypto from 'crypto';
import type { Tenant, TenantPlan } from '@prisma/client';
import { prisma } from '../prisma';
import { JWT_SECRET } from '../config';
import { enqueueJob, registerJobHandler, cancelPendingJobs } from '../jobs';
import type { BillingCycle, BillingProvider, PaidPlan, SettledPayment } from './types';
import { cardcom } from './cardcom';

export type { BillingCycle, PaidPlan } from './types';

// ─── Prices — the server-side source of truth ────────────────────────────────
// frontend/lib/plans.ts renders these numbers, but a browser can claim any price it
// likes, so the amount we actually charge is only ever read from here.
// Yearly = the advertised effective monthly rate × 12 (≈ two months free).
export const PLAN_PRICES: Record<PaidPlan, Record<BillingCycle, number>> = {
  BASIC: { monthly: 14_900, yearly: 148_800 },
  PRO: { monthly: 34_900, yearly: 349_200 },
};

/** Days a failed renewal keeps working while we retry the card. */
export const PAST_DUE_GRACE_DAYS = 7;
const RENEWAL_RETRY_DAYS = 3;
const MAX_RENEWAL_ATTEMPTS = 3;

const PROVIDERS: Record<string, BillingProvider> = { cardcom };
const DEFAULT_PROVIDER = process.env.BILLING_PROVIDER || 'cardcom';

export function providerFor(id: string = DEFAULT_PROVIDER): BillingProvider | null {
  return PROVIDERS[id] ?? null;
}

export function billingConfigured(): boolean {
  const p = providerFor();
  return Boolean(p?.configured());
}

// ─── Period math ─────────────────────────────────────────────────────────────
function addMonths(from: Date, months: number): Date {
  const out = new Date(from.getTime());
  const day = out.getUTCDate();
  out.setUTCMonth(out.getUTCMonth() + months);
  // Jan 31 + 1 month must be Feb 28, not Mar 3 — setUTCDate(0) walks back to the
  // last day of the intended month when the day-of-month didn't exist there.
  if (out.getUTCDate() < day) out.setUTCDate(0);
  return out;
}

export function periodEndFrom(start: Date, cycle: BillingCycle): Date {
  return addMonths(start, cycle === 'yearly' ? 12 : 1);
}

// ─── Checkout intent ref ─────────────────────────────────────────────────────
// The provider echoes this back on its callback. Signing it means a caller who
// forges a callback still can't name a tenant or a plan we didn't authorise.
export interface CheckoutIntent {
  tenantId: string;
  plan: PaidPlan;
  cycle: BillingCycle;
}

// Derived rather than using JWT_SECRET directly: one key, one job. Rotating session
// signing then can't silently invalidate in-flight checkouts, and vice versa.
const INTENT_KEY = crypto.createHmac('sha256', JWT_SECRET).update('billing-intent-v1').digest();

export function signIntent(intent: CheckoutIntent): string {
  const body = `${intent.tenantId}.${intent.plan}.${intent.cycle}`;
  return `${body}.${crypto.createHmac('sha256', INTENT_KEY).update(body).digest('base64url')}`;
}

export function verifyIntent(ref: string | null): CheckoutIntent | null {
  if (!ref) return null;
  const parts = ref.split('.');
  if (parts.length !== 4) return null;
  const [tenantId, plan, cycle] = parts;
  if (plan !== 'BASIC' && plan !== 'PRO') return null;
  if (cycle !== 'monthly' && cycle !== 'yearly') return null;

  // Constant-time: this signature is the only thing standing between a callback and a
  // free plan, so it must not leak how far a guess got via response timing.
  const expected = Buffer.from(signIntent({ tenantId, plan, cycle }));
  const actual = Buffer.from(ref);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return { tenantId, plan, cycle };
}

// ─── Access lock ─────────────────────────────────────────────────────────────
type LockView = Pick<Tenant, 'plan' | 'subStatus' | 'currentPeriodEnd'>;

/**
 * Whether a PAID tenant has fallen out of good standing. Trials are governed by
 * trialStatusOf instead, and a tenant with no currentPeriodEnd was granted its plan
 * by hand (super-admin) — neither is this function's business.
 */
export function subscriptionLocked(t: LockView, now: Date = new Date()): boolean {
  if (t.plan === 'TRIAL' || !t.currentPeriodEnd || t.subStatus === 'active') return false;
  // A failed card gets a dunning window; a customer who chose to cancel simply
  // runs out the period they already paid for.
  const graceDays = t.subStatus === 'past_due' ? PAST_DUE_GRACE_DAYS : 0;
  return now.getTime() > t.currentPeriodEnd.getTime() + graceDays * 86_400_000;
}

// ─── Applying a payment ──────────────────────────────────────────────────────
/**
 * Record a settled charge and move the tenant to paid state. Idempotent: the
 * unique (provider, providerRef) index means a webhook replay is a no-op rather
 * than a free extra month.
 *
 * Returns false when this exact payment was already applied.
 */
export async function applyPayment(args: {
  tenantId: string;
  provider: string;
  plan: PaidPlan;
  cycle: BillingCycle;
  settled: SettledPayment;
  /** Renewals extend from the old period end; new subscriptions start now. */
  extendFrom?: Date | null;
}): Promise<boolean> {
  const { tenantId, provider, plan, cycle, settled } = args;
  const now = new Date();
  // Never shorten a period by renewing early: extend from whichever is later.
  const start = args.extendFrom && args.extendFrom > now ? args.extendFrom : now;
  const end = periodEndFrom(start, cycle);

  try {
    await prisma.payment.create({
      data: {
        tenantId,
        provider,
        providerRef: settled.providerRef,
        plan,
        cycle,
        amount: settled.amount,
        status: 'paid',
        periodStart: start,
        periodEnd: end,
        invoiceUrl: settled.invoiceUrl,
        raw: (settled.raw ?? undefined) as object | undefined,
      },
    });
  } catch (e) {
    // P2002 = the unique (provider, providerRef) constraint fired: already applied.
    if ((e as { code?: string }).code === 'P2002') return false;
    throw e;
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan,
      billingProvider: provider,
      billingCycle: cycle,
      // Keep the existing token when this charge didn't mint a new one.
      ...(settled.token ? { billingToken: settled.token } : {}),
      subStatus: 'active',
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      // Paying ends the trial and undoes an in-grace account cancellation — a
      // customer who just handed over money is unambiguously staying.
      trialEndsAt: null,
      canceledAt: null,
      purgeAt: null,
    },
  });

  await scheduleRenewal(tenantId, end);
  return true;
}

/** Queue the renewal attempt, replacing any previously queued one. */
async function scheduleRenewal(tenantId: string, runAt: Date): Promise<void> {
  await cancelPendingJobs(tenantId, 'billing_renew', 'tenantId', tenantId);
  await enqueueJob(tenantId, 'billing_renew', runAt, { tenantId, attempt: 1 });
}

// ─── Renewal job ─────────────────────────────────────────────────────────────
interface RenewPayload {
  tenantId: string;
  attempt: number;
}

registerJobHandler('billing_renew', async (raw) => {
  const { tenantId, attempt = 1 } = (raw ?? {}) as RenewPayload;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;

  // Nothing to renew: never subscribed, already stopped, or the account is being closed.
  if (tenant.plan === 'TRIAL' || tenant.subStatus === 'canceled' || tenant.canceledAt) return;

  if (tenant.cancelAtPeriodEnd) {
    await prisma.tenant.update({ where: { id: tenantId }, data: { subStatus: 'canceled' } });
    return;
  }

  const provider = providerFor(tenant.billingProvider ?? undefined);
  const cycle = (tenant.billingCycle as BillingCycle) ?? 'monthly';
  const plan = tenant.plan as PaidPlan;
  const amount = PLAN_PRICES[plan]?.[cycle];

  if (!provider || !tenant.billingToken || !amount) {
    // No way to charge (token lost, provider deconfigured) — surface it as past_due
    // so the customer is prompted rather than silently kept on a free ride.
    await prisma.tenant.update({ where: { id: tenantId }, data: { subStatus: 'past_due' } });
    return;
  }

  const settled = await provider.chargeToken({
    token: tenant.billingToken,
    amount,
    description: `חידוש מנוי ${plan} (${cycle === 'yearly' ? 'שנתי' : 'חודשי'})`,
    email: tenant.email,
    tenantName: tenant.name,
  }).catch(() => null);

  if (settled) {
    await applyPayment({ tenantId, provider: provider.id, plan, cycle, settled, extendFrom: tenant.currentPeriodEnd });
    return;
  }

  // Declined. Keep retrying inside the dunning window, then stop asking.
  await prisma.tenant.update({ where: { id: tenantId }, data: { subStatus: 'past_due' } });
  if (attempt < MAX_RENEWAL_ATTEMPTS) {
    const next = new Date(Date.now() + RENEWAL_RETRY_DAYS * 86_400_000);
    await enqueueJob(tenantId, 'billing_renew', next, { tenantId, attempt: attempt + 1 });
  }
});

// ─── Public URLs ─────────────────────────────────────────────────────────────
export function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3002').split(',')[0].replace(/\/+$/, '');
}

/** Where the provider should call us back. Railway exposes its own domain at boot. */
export function apiUrl(): string {
  const explicit = process.env.PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${process.env.PORT || 3001}`;
}

export function planPrice(plan: PaidPlan, cycle: BillingCycle): number {
  return PLAN_PRICES[plan][cycle];
}

export type { TenantPlan };

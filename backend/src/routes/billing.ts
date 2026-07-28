import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  applyPayment, billingConfigured, frontendUrl, apiUrl, priceFor, providerFor,
  signIntent, verifyIntent, subscriptionLocked, winbackPercentFor, PAST_DUE_GRACE_DAYS,
} from '../lib/billing';
import type { BillingCycle, PaidPlan } from '../lib/billing/types';
import { rateLimited } from '../lib/rateLimit';

/** Authenticated subscription management. Mounted behind requireAuth. */
export const billingRouter = Router();
/** Provider callbacks. PUBLIC — mounted before the CORS wall, like the widget. */
export const billingWebhookRouter = Router();

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

// Money decisions belong to the account owner, not to every manager on the team.
function isTenantAdmin(req: Request): boolean {
  return ADMIN_ROLES.includes(req.user!.role);
}

function requireTenantAdmin(req: Request, res: Response): boolean {
  if (!isTenantAdmin(req)) {
    res.status(403).json({ error: 'רק אדמין יכול לנהל את המנוי והתשלומים' });
    return false;
  }
  return true;
}

function isPaidPlan(v: unknown): v is PaidPlan {
  return v === 'BASIC' || v === 'PRO';
}
function isCycle(v: unknown): v is BillingCycle {
  return v === 'monthly' || v === 'yearly';
}

// ─── GET /api/billing — what the customer is on and what they owe next ───────
billingRouter.get('/', async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: {
      plan: true, subStatus: true, billingCycle: true, currentPeriodEnd: true,
      cancelAtPeriodEnd: true, billingProvider: true, winbackPercent: true, winbackUntil: true,
    },
  });
  if (!tenant) return res.status(404).json({ error: 'לא נמצא' });

  // Every role needs the plan/lock state (the upgrade UI reads it), but receipts and
  // their invoice links — which resolve to a document carrying the owner's billing
  // details — stay with the admin, like the rest of this router.
  const payments = isTenantAdmin(req)
    ? await prisma.payment.findMany({
        where: { tenantId: req.user!.tenantId, status: 'paid' },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { id: true, amount: true, currency: true, plan: true, cycle: true, periodEnd: true, invoiceUrl: true, createdAt: true },
      })
    : [];

  return res.json({
    plan: tenant.plan,
    status: tenant.subStatus,
    cycle: tenant.billingCycle,
    currentPeriodEnd: tenant.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: tenant.cancelAtPeriodEnd,
    locked: subscriptionLocked(tenant),
    graceDays: PAST_DUE_GRACE_DAYS,
    checkoutAvailable: billingConfigured(),
    // 0 when there is no live offer, so the UI can just test for truthiness.
    discountPercent: winbackPercentFor(tenant),
    discountUntil: winbackPercentFor(tenant) ? tenant.winbackUntil?.toISOString() ?? null : null,
    payments,
  });
});

// ─── POST /api/billing/checkout — start a purchase ───────────────────────────
billingRouter.post('/checkout', async (req: Request, res: Response) => {
  if (!requireTenantAdmin(req, res)) return;

  const { plan, cycle } = req.body as { plan?: unknown; cycle?: unknown };
  if (!isPaidPlan(plan)) return res.status(400).json({ error: 'מסלול לא תקין' });
  if (!isCycle(cycle)) return res.status(400).json({ error: 'מחזור חיוב לא תקין' });

  const provider = providerFor();
  if (!provider?.configured()) {
    return res.status(503).json({ error: 'הסליקה אינה מוגדרת עדיין — פנה אלינו להפעלה ידנית של המסלול.' });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { id: true, name: true, email: true, winbackPercent: true, winbackUntil: true },
  });
  if (!tenant) return res.status(404).json({ error: 'לא נמצא' });

  // Read from the server-side price table plus this tenant's own live discount —
  // never from the request. The figure is then sealed into the signed ref, so the
  // callback checks against exactly what we authorised here.
  const amount = priceFor(tenant, plan, cycle);
  const ref = signIntent({ tenantId: tenant.id, plan, cycle, amount });

  try {
    const { redirectUrl } = await provider.createCheckout({
      tenantId: tenant.id,
      tenantName: tenant.name,
      email: tenant.email,
      plan,
      cycle,
      amount,
      ref,
      successUrl: `${frontendUrl()}/billing/return?status=success`,
      failureUrl: `${frontendUrl()}/billing/return?status=failed`,
      webhookUrl: `${apiUrl()}/api/billing/webhook/${provider.id}`,
    });
    return res.json({ redirectUrl });
  } catch (e) {
    console.error('[billing] checkout failed:', e);
    return res.status(502).json({ error: 'פתיחת דף התשלום נכשלה — נסה שוב בעוד רגע.' });
  }
});

// ─── POST /api/billing/cancel — stop auto-renewal, keep the paid days ────────
billingRouter.post('/cancel', async (req: Request, res: Response) => {
  if (!requireTenantAdmin(req, res)) return;
  const t = await prisma.tenant.update({
    where: { id: req.user!.tenantId },
    data: { cancelAtPeriodEnd: true },
    select: { currentPeriodEnd: true },
  });
  return res.json({ cancelAtPeriodEnd: true, activeUntil: t.currentPeriodEnd?.toISOString() ?? null });
});

// ─── POST /api/billing/resume — undo the above before the period ends ────────
billingRouter.post('/resume', async (req: Request, res: Response) => {
  if (!requireTenantAdmin(req, res)) return;
  await prisma.tenant.update({ where: { id: req.user!.tenantId }, data: { cancelAtPeriodEnd: false } });
  return res.json({ cancelAtPeriodEnd: false });
});

// ─── POST /api/billing/webhook/:provider — provider callback (PUBLIC) ────────
// Nothing here trusts the request body beyond a transaction handle: the adapter
// re-queries the provider, and the plan/tenant come from our own signed ref. A
// forged POST therefore buys nothing — worst case it wastes one outbound call.
billingWebhookRouter.post('/:provider', async (req: Request, res: Response) => {
  if (rateLimited(`billing-hook|${req.ip ?? 'ip'}`, 60)) return res.status(429).json({ ok: false });

  const provider = providerFor(req.params.provider);
  if (!provider) return res.status(404).json({ ok: false });

  try {
    const settled = await provider.settle(req.body);
    if (!settled) return res.json({ ok: true, applied: false });

    const intent = verifyIntent(settled.ref);
    if (!intent) {
      console.warn('[billing] callback with an unrecognised ref — ignored');
      return res.json({ ok: true, applied: false });
    }

    // Guard against a tampered hosted page: the money that actually moved must match
    // the figure we sealed into the signed ref at checkout. Comparing against the
    // signature rather than a fresh price lookup means a discount that lapsed while
    // the customer was paying cannot reject a payment we already took.
    if (settled.amount !== intent.amount) {
      console.warn(`[billing] amount mismatch for ${intent.tenantId}: charged ${settled.amount}, authorised ${intent.amount}`);
      return res.json({ ok: true, applied: false });
    }

    const applied = await applyPayment({
      tenantId: intent.tenantId,
      provider: provider.id,
      plan: intent.plan,
      cycle: intent.cycle,
      settled,
    });
    return res.json({ ok: true, applied });
  } catch (e) {
    // Answer 200 anyway: a provider that sees a 500 retries forever, and the
    // transaction is safely re-derivable from its own records if we did drop one.
    console.error('[billing] webhook failed:', e);
    return res.json({ ok: false });
  }
});

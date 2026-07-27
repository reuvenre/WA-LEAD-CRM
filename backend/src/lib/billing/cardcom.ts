// Cardcom adapter (LowProfile hosted payment page + stored-token recurring charges).
//
// Everything Cardcom-specific is in this file on purpose: endpoints, field casing,
// the shekels-vs-agorot conversion and the response-code convention. If Cardcom
// changes an API version, this is the only file that moves.
//
// Terminal setup (Railway env):
//   CARDCOM_TERMINAL   — terminal number from the Cardcom back office
//   CARDCOM_API_NAME   — API user name (NOT the back-office login)
//   CARDCOM_TEST_MODE  — '1' to run against Cardcom's test terminal
//
// ⚠️ Verify the field names below against YOUR terminal's API docs before going
// live — Cardcom ships several API generations and older terminals differ.

import type { BillingProvider, CheckoutRequest, SettledPayment } from './types';

const API_BASE = 'https://secure.cardcom.solutions/api/v11';
const ISO_ILS = 1;
const TIMEOUT_MS = 20_000;

// Cardcom talks in shekels with decimals; we hold agorot as integers everywhere else.
const toShekels = (agorot: number) => Math.round(agorot) / 100;
const toAgorot = (shekels: number) => Math.round(Number(shekels) * 100);

const terminal = () => Number(process.env.CARDCOM_TERMINAL || 0);
const apiName = () => process.env.CARDCOM_API_NAME || '';

interface CardcomResponse {
  ResponseCode?: number;
  Description?: string;
  [k: string]: unknown;
}

async function post(path: string, body: Record<string, unknown>): Promise<CardcomResponse> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ TerminalNumber: terminal(), ApiName: apiName(), ...body }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`Cardcom ${path} → HTTP ${r.status}`);
  return (await r.json()) as CardcomResponse;
}

// Cardcom signals success with ResponseCode 0 and describes the failure otherwise.
function ok(res: CardcomResponse): boolean {
  return Number(res.ResponseCode) === 0;
}

function pick(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// Card data and the reusable charge token must not sit in our ledger. We keep the
// response for dispute resolution, minus anything that is a credential or an identity
// document. Matching is on the lowercased key, since Cardcom's casing varies by field.
const REDACTED_KEYS = new Set([
  'token', 'cardnumber', 'cardowneridentitynumber', 'cardownerid',
  'cardvalidityyear', 'cardvaliditymonth', 'cardexpirationmm', 'cardexpirationyy',
  'apiname', 'terminalnumber',
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? '[redacted]' : redact(v);
  }
  return out;
}

/**
 * Build a SettledPayment from a Cardcom result — or null if the money did not move.
 *
 * FAILS CLOSED. If the fields below don't match your terminal's API generation this
 * returns null and no plan is granted, rather than handing out subscriptions for
 * declined cards. The rejection is logged with the codes it saw, so the very first
 * sandbox transaction tells you whether the field names need adjusting.
 */
function toSettled(res: CardcomResponse): SettledPayment | null {
  const tran = (res.TranzactionInfo ?? res.TranzactionInformation) as Record<string, unknown> | undefined;

  // A transaction block proves an attempt was RECORDED, not that it was approved — a
  // decline still gets a deal number. The envelope ResponseCode checked by the caller
  // only says the lookup succeeded, so the authorization result must be read here.
  if (!tran || Number(tran.ResponseCode) !== 0) {
    console.warn('[cardcom] not settling: transaction absent or not approved', {
      envelope: res.ResponseCode, transaction: tran?.ResponseCode, description: tran?.Description ?? res.Description,
    });
    return null;
  }

  // ChargeAndCreateToken settles two halves that can succeed independently; when the
  // charge half reports its own status, it has to have succeeded as well.
  if (res.OperationResponse !== undefined && Number(res.OperationResponse) !== 0) {
    console.warn('[cardcom] not settling: operation half failed', { operation: res.OperationResponse });
    return null;
  }

  const tranId = tran.TranzactionId ?? tran.InternalDealNumber;
  if (!tranId) {
    console.warn('[cardcom] not settling: approved transaction carries no id');
    return null;
  }

  // Strictly the captured amount. Falling back to the top-level Amount would echo the
  // sum we REQUESTED, which would reduce the caller's price check to comparing our own
  // price table against itself and let a zero or partial capture buy a full plan.
  const amountShekels = tran.Amount;
  if (typeof amountShekels !== 'number') {
    console.warn('[cardcom] not settling: no captured amount on the transaction');
    return null;
  }

  return {
    providerRef: String(tranId),
    amount: toAgorot(amountShekels),
    ref: (res.ReturnValue as string | undefined) ?? null,
    token: (pick(res, 'TokenInfo', 'Token') as string | undefined) ?? null,
    invoiceUrl: (pick(res, 'DocumentInfo', 'DocumentUrl') as string | undefined) ?? null,
    raw: redact(res),
  };
}

export const cardcom: BillingProvider = {
  id: 'cardcom',

  configured: () => Boolean(terminal() && apiName()),

  async createCheckout(req: CheckoutRequest) {
    const res = await post('/LowProfile/Create', {
      // ChargeAndCreateToken: take the money now AND keep a token, so the renewal
      // job can charge later without the customer re-entering a card.
      Operation: 'ChargeAndCreateToken',
      Amount: toShekels(req.amount),
      ISOCoinId: ISO_ILS,
      Language: 'he',
      ReturnValue: req.ref,
      ProductName: `${req.tenantName} — מסלול ${req.plan} (${req.cycle === 'yearly' ? 'שנתי' : 'חודשי'})`,
      SuccessRedirectUrl: req.successUrl,
      FailedRedirectUrl: req.failureUrl,
      WebHookUrl: req.webhookUrl,
      IsTest: process.env.CARDCOM_TEST_MODE === '1',
      // Ask Cardcom to issue and email the Israeli tax invoice, so we never have to
      // hold invoice-numbering responsibility ourselves.
      Document: {
        To: req.tenantName,
        Email: req.email ?? undefined,
        IsSendByEmail: Boolean(req.email),
        Products: [{ Description: `מנוי ${req.plan}`, UnitCost: toShekels(req.amount), Quantity: 1 }],
      },
    });

    const url = res.Url as string | undefined;
    if (!ok(res) || !url) {
      throw new Error(`Cardcom refused the checkout: ${res.Description ?? 'unknown error'} (code ${res.ResponseCode})`);
    }
    return { redirectUrl: url };
  },

  async settle(callbackBody: unknown) {
    // The callback body is attacker-reachable — it arrives on a public URL. All we
    // take from it is the LowProfileId, then we ask Cardcom what actually happened.
    const body = (callbackBody ?? {}) as Record<string, unknown>;
    const lowProfileId = (body.LowProfileId ?? body.lowprofilecode ?? body.LowProfileCode) as string | undefined;
    if (!lowProfileId) return null;

    const res = await post('/LowProfile/GetLpResult', { LowProfileId: lowProfileId });
    if (!ok(res)) return null;
    return toSettled(res);
  },

  async chargeToken({ token, amount, description, email, tenantName }) {
    const res = await post('/Transactions/Transaction', {
      Amount: toShekels(amount),
      ISOCoinId: ISO_ILS,
      Token: token,
      ProductName: description,
      IsTest: process.env.CARDCOM_TEST_MODE === '1',
      Document: {
        To: tenantName,
        Email: email ?? undefined,
        IsSendByEmail: Boolean(email),
        Products: [{ Description: description, UnitCost: toShekels(amount), Quantity: 1 }],
      },
    });
    if (!ok(res)) return null;
    return toSettled(res);
  },
};

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

/** Build a SettledPayment from a verified Cardcom transaction result. */
function toSettled(res: CardcomResponse): SettledPayment | null {
  // The transaction block is what proves money moved — a LowProfile page that was
  // merely opened and abandoned still returns a result object without one.
  const tran = (res.TranzactionInfo ?? res.TranzactionInformation) as Record<string, unknown> | undefined;
  const tranId = tran?.TranzactionId ?? res.TranzactionId ?? res.InternalDealNumber;
  if (!tranId) return null;

  const amountShekels = (tran?.Amount ?? res.Amount) as number | undefined;
  if (amountShekels === undefined) return null;

  return {
    providerRef: String(tranId),
    amount: toAgorot(amountShekels),
    ref: (res.ReturnValue as string | undefined) ?? null,
    token: (pick(res, 'TokenInfo', 'Token') as string | undefined) ?? null,
    invoiceUrl: (pick(res, 'DocumentInfo', 'DocumentUrl') as string | undefined) ?? null,
    raw: res,
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

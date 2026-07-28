// The money path. These are the assertions that stop a refactor from quietly giving
// away subscriptions — every case here corresponds to a specific way the system could
// hand out a paid plan for free, or charge the wrong amount.
import test from 'node:test';
import assert from 'node:assert/strict';

import { signIntent, verifyIntent, priceFor, winbackPercentFor, periodEndFrom, PLAN_PRICES } from '../src/lib/billing';
import { toSettled } from '../src/lib/billing/cardcom';

const INTENT = { tenantId: 'clx123abc', plan: 'PRO' as const, cycle: 'yearly' as const, amount: 349_200 };

test('signed intent round-trips every field', () => {
  const back = verifyIntent(signIntent(INTENT));
  assert.deepEqual(back, INTENT);
});

test('signed intent rejects tampering', async (t) => {
  const ref = signIntent(INTENT);
  const cases: Record<string, string> = {
    'a cheaper amount': ref.replace('349200', '100'),
    'a richer plan': ref.replace('PRO', 'BASIC'),
    'another tenant': ref.replace('clx123abc', 'clxvictim'),
    'a truncated signature': ref.slice(0, -4),
    'an extra segment': `${ref}.x`,
  };
  for (const [name, forged] of Object.entries(cases)) {
    await t.test(name, () => assert.equal(verifyIntent(forged), null));
  }
});

test('signed intent rejects malformed input', () => {
  assert.equal(verifyIntent(null), null);
  assert.equal(verifyIntent(''), null);
  assert.equal(verifyIntent('a.b.c.d.e'), null);
  // A zero or negative amount must never verify — that would be a free subscription.
  assert.equal(verifyIntent(signIntent({ ...INTENT, amount: 0 })), null);
  assert.equal(verifyIntent(signIntent({ ...INTENT, amount: -100 })), null);
});

test('price comes from the server table, discounted only by a live offer', () => {
  const list = PLAN_PRICES.BASIC.monthly;
  const live = new Date(Date.now() + 3 * 86_400_000);
  const dead = new Date(Date.now() - 86_400_000);

  assert.equal(priceFor({ winbackPercent: null, winbackUntil: null }, 'BASIC', 'monthly'), list);
  assert.equal(priceFor({ winbackPercent: 40, winbackUntil: dead }, 'BASIC', 'monthly'), list);
  assert.equal(priceFor({ winbackPercent: 40, winbackUntil: live }, 'BASIC', 'monthly'), Math.round(list * 0.6));
  assert.equal(priceFor({ winbackPercent: 40, winbackUntil: live }, 'PRO', 'yearly'), Math.round(PLAN_PRICES.PRO.yearly * 0.6));
});

test('a corrupt discount cannot produce a free or inflated charge', () => {
  const live = new Date(Date.now() + 86_400_000);
  assert.equal(winbackPercentFor({ winbackPercent: 500, winbackUntil: live }), 90);
  assert.equal(priceFor({ winbackPercent: -50, winbackUntil: live }, 'PRO', 'monthly'), PLAN_PRICES.PRO.monthly);
});

test('billing periods survive month ends', () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  assert.equal(iso(periodEndFrom(new Date(Date.UTC(2026, 0, 31)), 'monthly')), '2026-02-28');
  assert.equal(iso(periodEndFrom(new Date(Date.UTC(2028, 0, 31)), 'monthly')), '2028-02-29');
  assert.equal(iso(periodEndFrom(new Date(Date.UTC(2026, 2, 15)), 'monthly')), '2026-04-15');
  assert.equal(iso(periodEndFrom(new Date(Date.UTC(2026, 5, 15)), 'yearly')), '2027-06-15');
});

// ─── Cardcom settlement ──────────────────────────────────────────────────────
const approved = {
  ResponseCode: 0,
  ReturnValue: signIntent(INTENT),
  TranzactionInfo: { ResponseCode: 0, TranzactionId: 998877, Amount: 3492 },
  TokenInfo: { Token: 'tok_secret_value' },
  DocumentInfo: { DocumentUrl: 'https://invoice.example/1' },
};

test('an approved charge settles with the captured amount', () => {
  const s = toSettled(approved);
  assert.ok(s);
  assert.equal(s.providerRef, '998877');
  assert.equal(s.amount, 349_200); // shekels → agorot
  assert.equal(s.ref, approved.ReturnValue);
  assert.equal(s.invoiceUrl, 'https://invoice.example/1');
});

test('a DECLINED charge never settles', () => {
  // The whole point: a refused card still gets a deal number and the attempted amount.
  const declined = { ...approved, TranzactionInfo: { ResponseCode: 33, TranzactionId: 998877, Amount: 3492, Description: 'refused' } };
  assert.equal(toSettled(declined), null);
});

test('a charge whose token half succeeded but charge half failed never settles', () => {
  assert.equal(toSettled({ ...approved, OperationResponse: 5 }), null);
});

test('a result with no transaction block never settles', () => {
  const { TranzactionInfo, ...noTran } = approved;
  assert.equal(toSettled(noTran), null);
});

test('the requested amount is never used as the captured amount', () => {
  // Amount at the top level is what we ASKED for. Accepting it would turn the
  // caller's price check into a comparison of our own price table with itself.
  const noAmount = { ...approved, Amount: 3492, TranzactionInfo: { ResponseCode: 0, TranzactionId: 1 } };
  assert.equal(toSettled(noAmount), null);
});

test('the stored raw response carries no card credential', () => {
  const s = toSettled(approved);
  const raw = JSON.stringify(s!.raw);
  assert.ok(!raw.includes('tok_secret_value'), 'recurring token must be redacted from the ledger');
  assert.ok(raw.includes('[redacted]'));
  // The token still reaches the caller — it has to, to enable renewals — just not the ledger.
  assert.equal(s!.token, 'tok_secret_value');
});

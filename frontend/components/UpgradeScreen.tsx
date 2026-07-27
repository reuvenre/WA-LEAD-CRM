'use client';

import { Check, Minus, Sparkles, ArrowRight, Loader2, PartyPopper } from 'lucide-react';
import { PLANS, PLAN_FEATURES, PLAN_LIMITS, CURRENCY, planById, type PlanId } from '@/lib/plans';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || 'sales@wa-lead-crm.com';

// In-app upgrade screen: current plan, full plan comparison, and the CTA that hands
// off to the payment provider's hosted page. The price shown here is presentational —
// the server charges from its own price table, so nothing here can alter the amount.
export function UpgradeScreen({ currentPlan, onBack }: { currentPlan: PlanId; onBack: () => void }) {
  const [yearly, setYearly] = useState(false);
  const [pending, setPending] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [discountUntil, setDiscountUntil] = useState<string | null>(null);
  const cur = planById(currentPlan);

  // A lapsed trial may be carrying a win-back offer. The server is the authority on
  // whether it's still live — this only mirrors it, and the charged amount is
  // computed server-side regardless of what's rendered here.
  useEffect(() => {
    let alive = true;
    api.billing.status()
      .then((s) => { if (alive) { setDiscount(s.discountPercent || 0); setDiscountUntil(s.discountUntil); } })
      .catch(() => { /* the price grid is still correct without it */ });
    return () => { alive = false; };
  }, []);

  const discounted = (price: number) => Math.round((price * (100 - discount)) / 100);

  // Falls back to email only when the backend says no terminal is configured — a
  // real checkout failure must surface as an error, not as a silent mailto.
  const contactSales = (planId: PlanId) => {
    const price = yearly ? planById(planId).annualMonthly : planById(planId).monthly;
    const cycle = yearly ? 'שנתי' : 'חודשי';
    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`שדרוג למסלול ${planById(planId).name}`)}&body=${encodeURIComponent(`אני רוצה לשדרג למסלול ${planById(planId).name} (${cycle}, ${CURRENCY}${price}/חודש).`)}`;
  };

  const choose = async (planId: PlanId) => {
    if (planId === 'TRIAL' || pending) return;
    setPending(planId);
    setError(null);
    try {
      const { redirectUrl } = await api.billing.checkout(planId, yearly ? 'yearly' : 'monthly');
      window.location.href = redirectUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'שגיאה';
      // 503 from the checkout route = no payment terminal configured yet.
      if (msg.includes('הסליקה אינה מוגדרת')) {
        contactSales(planId);
        return;
      }
      setError(msg);
      setPending(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-muted" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-1">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 transition">
            <ArrowRight className="w-4 h-4" /> חזרה
          </button>
          <span className="text-xs text-slate-400">המסלול הנוכחי: <b className="text-slate-600">{cur.name}</b></span>
        </div>
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-brand-600 mb-1">
            <Sparkles className="w-5 h-5" />
            <h1 className="text-2xl font-bold text-slate-800">בחר את המסלול שלך</h1>
          </div>
          <p className="text-sm text-slate-500">שדרג בכל עת. ביטול בכל עת. ללא התחייבות.</p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className={`text-sm ${!yearly ? 'font-bold text-slate-800' : 'text-slate-400'}`}>חודשי</span>
          <button onClick={() => setYearly((v) => !v)} className={`relative w-12 h-6 rounded-full transition ${yearly ? 'bg-brand-600' : 'bg-slate-300'}`} aria-label="חיוב שנתי">
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${yearly ? 'right-0.5' : 'right-6'}`} />
          </button>
          <span className={`text-sm ${yearly ? 'font-bold text-slate-800' : 'text-slate-400'}`}>שנתי <span className="text-green-600 font-semibold">(חסכון ~2 חודשים)</span></span>
        </div>

        {discount > 0 && (
          <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-center">
            <div className="inline-flex items-center gap-2 text-brand-700 font-bold">
              <PartyPopper className="w-5 h-5" />
              {discount}% הנחה על התשלום הראשון
            </div>
            {discountUntil && (
              <div className="text-xs text-brand-600 mt-0.5">
                בתוקף עד {new Date(discountUntil).toLocaleDateString('he-IL')} — ההנחה מוחלת אוטומטית בתשלום
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {PLANS.map((p) => {
            const price = yearly ? p.annualMonthly : p.monthly;
            const isCurrent = p.id === currentPlan;
            return (
              <div key={p.id} className={`relative bg-white rounded-2xl p-5 flex flex-col ${p.highlight ? 'ring-2 ring-brand-600 shadow-lg' : 'border border-surface-border'}`}>
                {p.badge && <span className="absolute -top-3 right-5 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">{p.badge}</span>}
                <h3 className="text-lg font-bold text-slate-800">{p.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 min-h-[2.5rem]">{p.tagline}</p>
                <div className="my-3">
                  {price === 0 || price == null ? (
                    <span className="text-2xl font-bold text-slate-800">חינם</span>
                  ) : discount > 0 && p.id !== 'TRIAL' ? (
                    <>
                      <span className="text-lg text-slate-400 line-through">{CURRENCY}{price}</span>{' '}
                      <span className="text-3xl font-bold text-brand-600">{CURRENCY}{discounted(price)}</span>
                      <span className="text-sm text-slate-500"> / חודש</span>
                      <div className="text-xs font-semibold text-brand-600 mt-0.5">לתשלום הראשון, אח״כ {CURRENCY}{price}</div>
                    </>
                  ) : (
                    <><span className="text-3xl font-bold text-slate-800">{CURRENCY}{price}</span><span className="text-sm text-slate-500"> / חודש</span></>
                  )}
                </div>
                {isCurrent ? (
                  <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-semibold cursor-default">המסלול הנוכחי</button>
                ) : p.id === 'TRIAL' ? (
                  <button disabled className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-300 text-sm font-semibold cursor-default">—</button>
                ) : (
                  <button
                    onClick={() => choose(p.id)}
                    disabled={pending !== null}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait ${p.highlight ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft' : 'bg-brand-50 hover:bg-brand-100 text-brand-700'}`}
                  >
                    {pending === p.id && <Loader2 className="w-4 h-4 animate-spin" />}
                    {pending === p.id ? 'מעביר לתשלום…' : p.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison grid */}
        <div className="bg-white rounded-2xl border border-surface-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-subtle">
                <th className="text-right font-semibold text-slate-600 px-4 py-3">השוואת מסלולים</th>
                {PLANS.map((p) => <th key={p.id} className="text-center font-bold text-slate-800 px-2 py-3 w-24">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {PLAN_LIMITS.map((row) => (
                <tr key={row.label} className="border-b border-surface-border/60">
                  <td className="px-4 py-2.5 text-slate-600">{row.label}</td>
                  {PLANS.map((p) => <td key={p.id} className="text-center px-2 py-2.5 font-semibold text-slate-700">{row.values[p.id as PlanId]}</td>)}
                </tr>
              ))}
              {PLAN_FEATURES.map((f) => (
                <tr key={f.label} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 text-slate-600">{f.label}</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className="text-center px-2 py-2.5">
                      {f.tiers.includes(p.id as PlanId)
                        ? <Check className="w-4 h-4 text-green-600 inline" strokeWidth={3} />
                        : <Minus className="w-4 h-4 text-slate-300 inline" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">כל המחירים אינם כוללים מע״מ · חיוב מאובטח · אפשר לבטל בכל עת</p>
      </div>
    </div>
  );
}

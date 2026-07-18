'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Minus, ArrowLeft } from 'lucide-react';
import { MarketingHeader, MarketingFooter } from '@/components/marketing/MarketingChrome';
import { PLANS, PLAN_FEATURES, PLAN_LIMITS, CURRENCY, type PlanId } from '@/lib/plans';

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  return (
    <div className="bg-white min-h-screen flex flex-col" dir="rtl">
      <MarketingHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">תמחור פשוט ושקוף</h1>
          <p className="text-slate-500 mt-3">התחילו 14 יום חינם — ללא כרטיס אשראי. שדרגו או בטלו בכל עת.</p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm ${!yearly ? 'font-bold text-slate-800' : 'text-slate-400'}`}>חודשי</span>
          <button onClick={() => setYearly((v) => !v)} className={`relative w-12 h-6 rounded-full transition ${yearly ? 'bg-brand-600' : 'bg-slate-300'}`} aria-label="חיוב שנתי">
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${yearly ? 'right-0.5' : 'right-6'}`} />
          </button>
          <span className={`text-sm ${yearly ? 'font-bold text-slate-800' : 'text-slate-400'}`}>שנתי <span className="text-green-600 font-semibold">(חסכון ~2 חודשים)</span></span>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {PLANS.map((p) => {
            const price = yearly ? p.annualMonthly : p.monthly;
            return (
              <div key={p.id} className={`relative bg-white rounded-2xl p-6 flex flex-col ${p.highlight ? 'ring-2 ring-brand-600 shadow-lg' : 'border border-surface-border'}`}>
                {p.badge && <span className="absolute -top-3 right-6 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">{p.badge}</span>}
                <h3 className="text-lg font-bold text-slate-800">{p.name}</h3>
                <p className="text-xs text-slate-500 mt-1 min-h-[2.75rem] leading-relaxed">{p.tagline}</p>
                <div className="my-4">
                  {price === 0 || price == null
                    ? <span className="text-3xl font-bold text-slate-800">חינם</span>
                    : <><span className="text-4xl font-bold text-slate-800">{CURRENCY}{price}</span><span className="text-sm text-slate-500"> / חודש</span></>}
                </div>
                <Link href="/register" className={`w-full text-center py-2.5 rounded-xl text-sm font-semibold transition ${p.highlight ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft' : 'bg-brand-50 hover:bg-brand-100 text-brand-700'}`}>
                  {p.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Comparison grid */}
        <div className="bg-white rounded-2xl border border-surface-border overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-surface-border bg-surface-subtle">
                <th className="text-right font-semibold text-slate-600 px-4 py-3">השוואת מסלולים</th>
                {PLANS.map((p) => <th key={p.id} className="text-center font-bold text-slate-800 px-2 py-3 w-28">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {PLAN_LIMITS.map((row) => (
                <tr key={row.label} className="border-b border-surface-border/60">
                  <td className="px-4 py-2.5 text-slate-600">{row.label}</td>
                  {PLANS.map((p) => <td key={p.id} className="text-center px-2 py-2.5 font-semibold text-slate-700">{row.values[p.id]}</td>)}
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

        <p className="text-center text-xs text-slate-400 mt-6">כל המחירים אינם כוללים מע״מ · חיוב מאובטח · ביטול בכל עת</p>

        <div className="text-center mt-10">
          <Link href="/register" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3.5 rounded-xl transition shadow-lg">
            התחילו 14 יום חינם <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

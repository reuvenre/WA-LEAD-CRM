'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

// Where the payment provider sends the customer back to. The redirect proves the
// customer finished the form — it does NOT prove we were paid, because the money is
// confirmed on the server-to-server webhook. So on "success" we poll our own backend
// until the subscription actually flips to active, and only then say so.
const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1500;

type View = 'confirming' | 'active' | 'slow' | 'failed';

function BillingReturn() {
  const params = useSearchParams();
  const declared = params.get('status');
  const [view, setView] = useState<View>(declared === 'success' ? 'confirming' : 'failed');

  useEffect(() => {
    if (declared !== 'success') return;
    let cancelled = false;
    let tries = 0;

    const poll = async () => {
      if (cancelled) return;
      tries += 1;
      try {
        const s = await api.billing.status();
        if (cancelled) return;
        if (s.status === 'active') {
          setView('active');
          return;
        }
      } catch {
        // Network hiccup mid-poll shouldn't end the wait — just try again.
      }
      if (tries >= POLL_ATTEMPTS) setView('slow');
      else setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();
    return () => { cancelled = true; };
  }, [declared]);

  const backToApp = (
    <a href="/" className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition">
      חזרה למערכת
    </a>
  );

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-surface-border p-8 text-center">
        {view === 'confirming' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-brand-600 animate-spin" />
            <h1 className="mt-4 text-xl font-bold text-slate-800">מאשרים את התשלום…</h1>
            <p className="mt-2 text-sm text-slate-500">רגע אחד — אנחנו מוודאים מול חברת הסליקה.</p>
          </>
        )}

        {view === 'active' && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
            <h1 className="mt-4 text-xl font-bold text-slate-800">התשלום התקבל — המסלול פעיל</h1>
            <p className="mt-2 text-sm text-slate-500">חשבונית המס נשלחה למייל שלך. תודה!</p>
            {backToApp}
          </>
        )}

        {view === 'slow' && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-amber-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-800">התשלום נקלט</h1>
            <p className="mt-2 text-sm text-slate-500">
              האישור מחברת הסליקה עדיין בדרך. המסלול יופעל תוך דקות ספורות — אין צורך לשלם שוב.
              אם זה לא קרה, פנה אלינו ונשלים ידנית.
            </p>
            {backToApp}
          </>
        )}

        {view === 'failed' && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-800">התשלום לא הושלם</h1>
            <p className="mt-2 text-sm text-slate-500">לא בוצע חיוב. אפשר לנסות שוב מתוך מסך המסלולים.</p>
            {backToApp}
          </>
        )}
      </div>
    </main>
  );
}

export default function BillingReturnPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <BillingReturn />
    </Suspense>
  );
}

'use client';

import { AlertTriangle } from 'lucide-react';
import { MarketingHeader, MarketingFooter } from './MarketingChrome';
import { isCompanyConfigured, missingCompanyFields } from '@/lib/company';

// Shared shell for the legal pages. The amber draft banner shows itself for exactly as
// long as lib/company.ts still has an unfilled field — nobody has to remember to turn
// it off, and it cannot be left on by accident after the details are in. Pass
// showPlaceholderNote explicitly only to override that for a specific page.
export function LegalLayout({
  title, updated, showPlaceholderNote, children,
}: { title: string; updated: string; showPlaceholderNote?: boolean; children: React.ReactNode }) {
  const showDraftNote = showPlaceholderNote ?? !isCompanyConfigured();
  const missing = missingCompanyFields();
  return (
    <div className="bg-white min-h-screen flex flex-col" dir="rtl">
      <MarketingHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{title}</h1>
        <p className="text-xs text-slate-400 mt-1">עודכן לאחרונה: {updated}</p>

        {showDraftNote && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-5 text-xs text-amber-800 leading-relaxed">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <b>טיוטה למילוי:</b> השדות בסוגריים המרובעים הם מקומות שמורים. השלם אותם בקובץ אחד — <code className="bg-amber-100 px-1 rounded">frontend/lib/company.ts</code> — והבאנר הזה ייעלם מעצמו.
              {missing.length > 0 && <> חסרים כרגע: <b>{missing.join(', ')}</b>.</>}
              {' '}מומלץ להעביר את המסמך לבדיקת עורך/ת דין לפני ההשקה.
            </span>
          </div>
        )}

        <article className="prose-legal mt-6 space-y-5 text-sm text-slate-600 leading-relaxed">
          {children}
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}

// Small helpers for consistent legal typography without pulling in a prose plugin.
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

export function PH({ children }: { children: React.ReactNode }) {
  return <code className="bg-slate-100 text-slate-700 px-1 rounded text-[13px]">[{children}]</code>;
}

/**
 * A company detail from lib/company.ts — the real value once it's filled, a visible
 * placeholder until then. Legal pages use this instead of hard-coding anything, so
 * filling one file updates every document at once.
 */
export function Detail({ value, label }: { value: string; label: string }) {
  return value.trim() ? <>{value}</> : <PH>{label}</PH>;
}

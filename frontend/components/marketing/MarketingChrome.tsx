'use client';

import Link from 'next/link';

// Shared public-site header + footer for the landing, pricing, and legal pages.
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 bg-[#101E38]/95 backdrop-blur border-b border-white/10" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.png" alt="Real Estate Lead CRM" className="w-full h-full object-contain" />
          </span>
          <span className="text-white font-bold text-[15px] truncate">Real Estate Lead CRM</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/pricing" className="text-slate-300 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition">תמחור</Link>
          <Link href="/login" className="text-slate-300 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition">כניסה</Link>
          <Link href="/register" className="text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition whitespace-nowrap">התחל חינם</Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const year = 2026;
  return (
    <footer className="bg-[#101E38] text-slate-400 border-t border-white/10" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row justify-between gap-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mark.png" alt="" className="w-full h-full object-contain" />
              </span>
              <span className="text-white font-bold text-sm">Real Estate Lead CRM</span>
            </div>
            <p className="text-xs leading-relaxed">ה-CRM שמחבר את כל שיחות ה-WhatsApp, הלידים והפגישות שלכם למקום אחד. מבית WIN SOLUTIONS.</p>
          </div>
          <div className="flex gap-12">
            <div>
              <p className="text-white font-semibold text-sm mb-3">מוצר</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/pricing" className="hover:text-white transition">תמחור</Link></li>
                <li><Link href="/register" className="hover:text-white transition">התחל חינם</Link></li>
                <li><Link href="/login" className="hover:text-white transition">כניסה למערכת</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-3">משפטי</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/terms" className="hover:text-white transition">תנאי שימוש</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition">מדיניות פרטיות</Link></li>
                <li><Link href="/accessibility" className="hover:text-white transition">הצהרת נגישות</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-6 text-xs">© {year} Real Estate Lead CRM · כל הזכויות שמורות</div>
      </div>
    </footer>
  );
}

'use client';

import Link from 'next/link';
import {
  MessageSquare, GitBranch, CalendarDays, Megaphone, Bot, BarChart3,
  Globe, Users, ShieldCheck, ArrowLeft, Check,
} from 'lucide-react';
import { MarketingHeader, MarketingFooter } from './MarketingChrome';
import { PLANS, CURRENCY } from '@/lib/plans';

const FEATURES = [
  { icon: MessageSquare, title: 'כל שיחות ה-WhatsApp במקום אחד', body: 'קבלו ושלחו הודעות, ראו את כל ההיסטוריה, ונהלו את כל הלידים מתיבה אחת — בלי לאבד אף פנייה.' },
  { icon: GitBranch, title: 'פייפליין ויזואלי', body: 'גררו לידים בין שלבים בלוח Kanban וראו בדיוק איפה כל עסקה עומדת.' },
  { icon: Bot, title: 'מענה אוטומטי חכם', body: 'ברכה לפונה חדש, הודעת "מחוץ לשעות", והפניה אוטומטית — גם כשאתם לא ליד המסך.' },
  { icon: Users, title: 'ניתוב אוטומטי לנציגים', body: 'כל ליד חדש מתחלק אוטומטית בין הנציגים הפעילים, כך שאף פנייה לא נופלת בין הכיסאות.' },
  { icon: Megaphone, title: 'קמפיינים ורצפי Drip', body: 'שלחו הודעה ממוקדת לאלפי לידים בקצב בטוח מפני חסימה, או בנו רצף מעקב אוטומטי.' },
  { icon: BarChart3, title: 'דשבורד וזמני תגובה', body: 'ראו כמה לידים נכנסו, מי חם, ומהו זמן התגובה של כל נציג מול יעד ה-SLA.' },
  { icon: CalendarDays, title: 'יומן פגישות מסונכרן', body: 'קבעו פגישות ישירות מתוך השיחה וסנכרנו ליומן Google.' },
  { icon: Globe, title: 'צ׳אט לאתר שלכם', body: 'הטמיעו ווידג׳ט צ׳אט באתר בשורת קוד אחת — כל פנייה הופכת לליד במערכת.' },
];

export function Landing() {
  return (
    <div className="bg-white" dir="rtl">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#101E38] to-[#1a2f52] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <span className="inline-block bg-white/10 text-brand-200 text-xs font-semibold px-3 py-1 rounded-full mb-5">CRM ל-WhatsApp לעולם הנדל״ן</span>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight max-w-3xl mx-auto">הפסיקו לאבד לידים בין הצ׳אטים</h1>
          <p className="text-slate-300 text-base sm:text-lg mt-5 max-w-2xl mx-auto leading-relaxed">
            כל שיחות ה-WhatsApp, הלידים, הפגישות והנציגים שלכם — במערכת אחת חכמה שבנויה לסוכני ויזמי נדל״ן בישראל.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-7 py-3.5 rounded-xl transition shadow-lg">
              התחילו 14 יום חינם <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-7 py-3.5 rounded-xl transition">
              צפו בתמחור
            </Link>
          </div>
          <p className="text-slate-400 text-sm mt-4">ללא כרטיס אשראי · הקמה תוך דקות · בעברית מלאה</p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">כל מה שצריך כדי לסגור יותר עסקאות</h2>
          <p className="text-slate-500 mt-3 max-w-2xl mx-auto">במקום עשר אפליקציות ואקסלים — מערכת אחת שמנהלת את כל מסע הלקוח, מהפנייה הראשונה ועד הסגירה.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface-subtle rounded-2xl p-5 border border-surface-border">
              <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-brand-600" />
              </div>
              <h3 className="font-bold text-slate-800 text-[15px] mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Anti-ban / trust strip */}
      <section className="bg-surface-subtle border-y border-surface-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            { icon: ShieldCheck, title: 'הגנת אנטי-באן', body: 'שליחה בקצב מבוקר ומרווח כדי לשמור על מספר ה-WhatsApp שלכם בטוח.' },
            { icon: Users, title: 'ריבוי נציגים', body: 'כל נציג רואה רק את הלידים שלו; המנהל רואה את התמונה המלאה.' },
            { icon: ShieldCheck, title: 'נתונים מאובטחים', body: 'הצפנה, הרשאות לפי תפקיד, ואימות דו-שלבי לחשבון שלכם.' },
          ].map((t) => (
            <div key={t.title}>
              <t.icon className="w-8 h-8 text-brand-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800">{t.title}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">תמחור פשוט ושקוף</h2>
        <p className="text-slate-500 mt-3">התחילו בחינם ל-14 יום. שדרגו כשמתאים לכם.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 max-w-3xl mx-auto text-right">
          {PLANS.map((p) => (
            <div key={p.id} className={`rounded-2xl p-5 flex flex-col ${p.highlight ? 'ring-2 ring-brand-600 shadow-lg' : 'border border-surface-border'}`}>
              {p.badge && <span className="self-start bg-brand-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full mb-2">{p.badge}</span>}
              <h3 className="font-bold text-slate-800">{p.name}</h3>
              <div className="my-2">
                {p.monthly === 0 || p.monthly == null
                  ? <span className="text-2xl font-bold text-slate-800">חינם</span>
                  : <><span className="text-3xl font-bold text-slate-800">{CURRENCY}{p.monthly}</span><span className="text-sm text-slate-500"> / חודש</span></>}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed min-h-[2.5rem]">{p.tagline}</p>
            </div>
          ))}
        </div>
        <Link href="/pricing" className="inline-flex items-center gap-2 text-brand-600 font-semibold mt-8 hover:gap-3 transition-all">
          השוואת מסלולים מלאה <ArrowLeft className="w-4 h-4" />
        </Link>
      </section>

      {/* Final CTA */}
      <section className="bg-[#101E38] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">מוכנים להפסיק לפספס לידים?</h2>
          <p className="text-slate-300 mt-3">הקימו את המערכת שלכם תוך דקות — הניסיון חינם, ללא כרטיס אשראי.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-sm text-slate-300">
            {['14 יום חינם', 'ללא כרטיס אשראי', 'ביטול בכל עת'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-green-400" /> {t}</span>
            ))}
          </div>
          <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3.5 rounded-xl transition shadow-lg mt-8">
            התחילו עכשיו <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

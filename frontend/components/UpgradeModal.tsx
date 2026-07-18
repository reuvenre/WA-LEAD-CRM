'use client';

import { useEffect, useState } from 'react';
import { X, Check, Sparkles, ArrowLeft } from 'lucide-react';
import { onUpgrade, type UpgradePrompt } from '@/lib/upgrade';
import { PLANS, CURRENCY, FEATURE_MIN_PLAN, planById, type PlanId } from '@/lib/plans';

// One shared modal, opened by openUpgrade() from anywhere (locked nav item, a 402/403
// API response, the trial-expired banner). Shows the plan the user needs and routes to
// the full upgrade screen. The actual payment step is wired separately.
export function UpgradeModal({ currentPlan, onGoToUpgrade }: { currentPlan?: PlanId; onGoToUpgrade: () => void }) {
  const [prompt, setPrompt] = useState<UpgradePrompt | null>(null);
  useEffect(() => onUpgrade(setPrompt), []);
  if (!prompt) return null;

  const targetId: PlanId = prompt.suggestedPlan
    ?? (prompt.feature ? FEATURE_MIN_PLAN[prompt.feature] : undefined)
    ?? (prompt.reason === 'trial' ? 'BASIC' : 'PRO');
  const target = planById(targetId);
  const close = () => setPrompt(null);

  const title = prompt.reason === 'trial' ? 'תקופת הניסיון הסתיימה'
    : prompt.reason === 'limit' ? 'הגעת למגבלת המסלול'
    : 'פיצ׳ר במסלול בתשלום';
  const sub = prompt.message
    || (prompt.reason === 'trial'
      ? 'המערכת עברה למצב קריאה בלבד. שדרג כדי להמשיך לשלוח, לערוך ולנהל לידים.'
      : `הפיצ׳ר הזה כלול במסלול ${target.name} ומעלה.`);

  const perks = PLANS
    .find((p) => p.id === targetId)
    ? Object.entries(FEATURE_MIN_PLAN).filter(([, min]) => min === targetId)
    : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={close} dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-l from-brand-600 to-brand-700 px-6 py-5 text-white relative">
          <button onClick={close} className="absolute top-4 left-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition" aria-label="סגור">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-bold text-lg">{title}</h2>
          </div>
          <p className="text-white/90 text-sm leading-relaxed">{sub}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs text-slate-500">מסלול מומלץ</p>
              <p className="text-xl font-bold text-slate-800">{target.name}</p>
            </div>
            {target.monthly != null && target.monthly > 0 && (
              <p className="text-slate-800"><span className="text-2xl font-bold">{CURRENCY}{target.monthly}</span><span className="text-sm text-slate-500"> / חודש</span></p>
            )}
          </div>

          {perks.length > 0 && (
            <ul className="space-y-1.5">
              {perks.slice(0, 5).map(([key]) => (
                <li key={key} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-green-600" strokeWidth={3} />
                  </span>
                  {PERK_LABELS[key] ?? key}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => { close(); onGoToUpgrade(); }}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-3 rounded-xl transition shadow-soft"
          >
            צפה במסלולים ושדרג
            <ArrowLeft className="w-4 h-4" />
          </button>
          {currentPlan && <p className="text-center text-xs text-slate-400">המסלול הנוכחי שלך: {planById(currentPlan).name}</p>}
        </div>
      </div>
    </div>
  );
}

const PERK_LABELS: Record<string, string> = {
  autoReplies: 'מענה אוטומטי', roundRobin: 'ניתוב אוטומטי בין נציגים', scheduledMessages: 'תזמון הודעות',
  webchat: 'צ׳אט לאתר', customAttributes: 'שדות מותאמים', csat: 'סקרי שביעות רצון', analytics: 'דשבורד ואנליטיקה',
  googleCalendar: 'יומן Google', automations: 'אוטומציות', broadcast: 'קמפיינים ורצפי Drip',
  multiLine: 'עד 5 קווי WhatsApp', apiAccess: 'גישת API', apifyLive: 'משיכת דירות יד-שנייה חיה', listings: 'מודול יד שנייה',
};

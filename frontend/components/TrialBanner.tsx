'use client';

import { Clock, Lock, ArrowLeft } from 'lucide-react';

export interface TrialInfo { onTrial: boolean; expired: boolean; daysLeft: number | null }

// Slim banner across the top of the app during the free trial. Two states:
//  • active  → "X days left in your trial" + upgrade link
//  • expired → read-only warning (amber→red) + upgrade CTA
// Renders nothing for paid plans (onTrial === false).
export function TrialBanner({ trial, onUpgrade }: { trial: TrialInfo | null; onUpgrade: () => void }) {
  if (!trial?.onTrial) return null;

  if (trial.expired) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs sm:text-sm" dir="rtl">
        <Lock className="w-4 h-4 flex-shrink-0" />
        <span className="font-semibold">תקופת הניסיון הסתיימה — המערכת במצב קריאה בלבד.</span>
        <button onClick={onUpgrade} className="mr-auto inline-flex items-center gap-1 font-bold bg-white text-red-700 rounded-lg px-3 py-1 hover:bg-red-50 transition whitespace-nowrap">
          שדרג עכשיו <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const days = trial.daysLeft ?? 0;
  const label = days <= 0 ? 'הניסיון מסתיים היום' : days === 1 ? 'נותר יום אחד לניסיון' : `נותרו ${days} ימים לניסיון החינם`;
  const urgent = days <= 3;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm ${urgent ? 'bg-amber-500 text-white' : 'bg-brand-50 text-brand-800'}`} dir="rtl">
      <Clock className="w-4 h-4 flex-shrink-0" />
      <span className="font-semibold">{label}.</span>
      <button onClick={onUpgrade} className={`mr-auto inline-flex items-center gap-1 font-bold rounded-lg px-3 py-1 transition whitespace-nowrap ${urgent ? 'bg-white text-amber-700 hover:bg-amber-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
        שדרג <ArrowLeft className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

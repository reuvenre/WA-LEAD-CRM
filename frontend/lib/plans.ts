// ─── Pricing — the single source of truth for the marketing/upgrade surfaces ──
// The pricing page, the in-app upgrade modal, and the plan-comparison table all read
// from here. Prices are proposals for the Israeli market — edit these numbers (and
// `annualMonthly` for the yearly view) in ONE place and everything updates.
//
// ⚠️ Changing what each tier can DO is a backend change (backend/src/lib/entitlements.ts
// ENTITLEMENTS). This file only controls how the tiers are PRESENTED and priced.

export type PlanId = 'TRIAL' | 'BASIC' | 'PRO';

export interface PlanFeature {
  label: string;
  /** Tiers that include this feature (for the ✓/– comparison grid). */
  tiers: PlanId[];
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Monthly price in ₪. null = free / contact. */
  monthly: number | null;
  /** Effective monthly price when paying yearly (usually ~2 months free). */
  annualMonthly: number | null;
  highlight?: boolean;
  badge?: string;
  cta: string;
}

export const CURRENCY = '₪';

export const PLANS: Plan[] = [
  {
    id: 'TRIAL',
    name: 'ניסיון',
    tagline: 'כל היכולות של בייסיק — חינם ל-14 יום, ללא כרטיס אשראי',
    monthly: 0,
    annualMonthly: 0,
    cta: 'התחל ניסיון חינם',
  },
  {
    id: 'BASIC',
    name: 'בייסיק',
    tagline: 'לעסק או סוכן יחיד שרוצה להפסיק לפספס לידים',
    monthly: 149,
    annualMonthly: 124,
    cta: 'בחר בייסיק',
  },
  {
    id: 'PRO',
    name: 'פרו',
    tagline: 'לצוות שמוכר בקצב — כל הכלים, בלי תקרה',
    monthly: 349,
    annualMonthly: 291,
    highlight: true,
    badge: 'הכי פופולרי',
    cta: 'בחר פרו',
  },
];

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

// Feature comparison grid — ordered by how a buyer evaluates the product.
// TRIAL mirrors BASIC everywhere: the free trial is a full 14-day taste of BASIC
// (see backend ENTITLEMENTS — TRIAL === BASIC), so every BASIC row is ticked for TRIAL.
export const PLAN_FEATURES: PlanFeature[] = [
  { label: 'ניהול לידים ושיחות WhatsApp', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'פייפליין (Kanban) ויומן פגישות', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'תבניות תשובה מהירה', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'מענה אוטומטי (ברכה / מחוץ לשעות)', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'ניתוב אוטומטי בין נציגים (round-robin)', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'תזמון הודעות (שליחה מאוחר יותר)', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'צ׳אט לאתר (ווידג׳ט)', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'שדות מותאמים אישית ללידים', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'סקרי שביעות רצון (CSAT)', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'דשבורד ואנליטיקה', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'יומן Google', tiers: ['TRIAL', 'BASIC', 'PRO'] },
  { label: 'קמפייני Broadcast + רצפי Drip', tiers: ['PRO'] },
  { label: 'מספר קווי WhatsApp (עד 5)', tiers: ['PRO'] },
  { label: 'גישת API + אינטגרציות', tiers: ['PRO'] },
];

// Limits row (numbers, not check-marks) mirrored from the backend entitlements.
// TRIAL === BASIC limits (a full BASIC taste), so their columns match.
export const PLAN_LIMITS: { label: string; values: Record<PlanId, string> }[] = [
  { label: 'נציגים', values: { TRIAL: '3', BASIC: '3', PRO: '15' } },
  { label: 'לידים', values: { TRIAL: '1,500', BASIC: '1,500', PRO: '25,000' } },
  { label: 'הודעות ליום לכל קו', values: { TRIAL: '150', BASIC: '150', PRO: '300' } },
];

// Map a locked backend feature key → the minimum plan that unlocks it, for upsell copy.
export const FEATURE_MIN_PLAN: Record<string, PlanId> = {
  autoReplies: 'BASIC', roundRobin: 'BASIC', scheduledMessages: 'BASIC', webchat: 'BASIC',
  customAttributes: 'BASIC', csat: 'BASIC', analytics: 'BASIC', googleCalendar: 'BASIC',
  automations: 'BASIC',
  broadcast: 'PRO', multiLine: 'PRO', apiAccess: 'PRO', apifyLive: 'PRO', listings: 'PRO',
};

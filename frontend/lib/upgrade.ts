// Tiny event bus so any part of the app (a 402/403 API response, a locked nav item,
// a trial-expired banner) can open the single shared upgrade modal without prop-drilling.
import type { PlanId } from './plans';

export interface UpgradePrompt {
  reason: 'feature' | 'trial' | 'limit' | 'manual';
  feature?: string;       // backend feature key, when reason === 'feature'
  suggestedPlan?: PlanId; // tier that unlocks it
  message?: string;       // server-provided explanation
}

const EVENT = 'app:upgrade';

export function openUpgrade(prompt: UpgradePrompt = { reason: 'manual' }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<UpgradePrompt>(EVENT, { detail: prompt }));
}

export function onUpgrade(handler: (p: UpgradePrompt) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<UpgradePrompt>).detail);
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

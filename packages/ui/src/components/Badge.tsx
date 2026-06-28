import type { ReactNode } from 'react';
import { cn } from '../cn';

export type BadgeTone = 'brand' | 'slate' | 'green' | 'amber' | 'red' | 'indigo' | 'emerald';

const TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-100 text-brand-700',
  slate: 'bg-slate-100 text-slate-600',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  emerald: 'bg-emerald-100 text-emerald-700',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

/** Small status / source pill (e.g. lead status, listing source, private/agency). */
export function Badge({ tone = 'slate', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}

import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface StatProps {
  label: string;
  value: ReactNode;
  className?: string;
}

/** Compact stat tile (rooms / floor / sqm cells inside a listing or property card). */
export function Stat({ label, value, className }: StatProps) {
  return (
    <div className={cn('bg-surface-muted rounded-md px-2 py-1.5 text-center', className)}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

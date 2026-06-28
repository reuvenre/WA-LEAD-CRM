import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

/** Neutral content card (the app's ".data-card"). Clickable when onClick is set. */
export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-surface-border rounded-lg',
        onClick && 'cursor-pointer hover:shadow-card transition',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Dashboard KPI card (the app's ".kpi-card") — label, big value, optional hint/icon. */
export function KpiCard({ label, value, hint, icon, className }: KpiCardProps) {
  return (
    <div className={cn('bg-white border border-surface-border rounded-lg p-[18px]', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        {icon && <span className="text-brand-600">{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

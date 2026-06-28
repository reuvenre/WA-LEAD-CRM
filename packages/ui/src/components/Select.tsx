import type { SelectHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({ label, className, children, ...rest }: SelectProps) {
  return (
    <label className="block space-y-1">
      {label && <span className="text-xs font-semibold text-slate-600">{label}</span>}
      <select
        className={cn(
          'w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

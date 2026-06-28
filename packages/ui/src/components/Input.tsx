import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Optional leading (right, in RTL) icon. */
  icon?: ReactNode;
}

export function Input({ label, icon, className, ...rest }: InputProps) {
  return (
    <label className="block space-y-1">
      {label && <span className="text-xs font-semibold text-slate-600">{label}</span>}
      <span className="relative block">
        {icon && (
          <span className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none">{icon}</span>
        )}
        <input
          className={cn(
            'w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition',
            icon && 'pr-9',
            className,
          )}
          {...rest}
        />
      </span>
    </label>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft',
  secondary: 'bg-white border border-brand-200 text-brand-600 hover:bg-brand-50',
  ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-md',
  md: 'text-sm px-4 py-2.5 gap-2 rounded-lg',
  lg: 'text-base px-5 py-3 gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon (e.g. a lucide-react icon element). */
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

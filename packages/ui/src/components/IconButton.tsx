import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type IconButtonTone = 'default' | 'brand' | 'danger';

const TONES: Record<IconButtonTone, string> = {
  default: 'text-slate-300 hover:text-slate-600 hover:bg-slate-100',
  brand: 'text-slate-300 hover:text-brand-600 hover:bg-brand-50',
  danger: 'text-slate-300 hover:text-red-600 hover:bg-red-50',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** Required for a11y on an icon-only control. */
  'aria-label': string;
  tone?: IconButtonTone;
}

export function IconButton({ icon, tone = 'default', className, ...rest }: IconButtonProps) {
  return (
    <button
      className={cn('inline-flex items-center justify-center w-8 h-8 rounded-lg transition', TONES[tone], className)}
      {...rest}
    >
      {icon}
    </button>
  );
}

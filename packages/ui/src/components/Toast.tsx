import type { ReactNode } from 'react';
import { cn } from '../cn';

export type ToastTone = 'default' | 'success' | 'error';

const TONES: Record<ToastTone, string> = {
  default: 'bg-slate-900 text-white',
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
};

export interface ToastProps {
  children: ReactNode;
  tone?: ToastTone;
  className?: string;
}

/** Bottom-centered transient notification. Render conditionally; the app owns the timer. */
export function Toast({ children, tone = 'default', className }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-50 text-xs font-medium px-4 py-2.5 rounded-lg re-fade-in',
        TONES[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

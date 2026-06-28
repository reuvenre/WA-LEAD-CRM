import { cn } from '../cn';

export interface SpinnerProps {
  /** Diameter in px. */
  size?: number;
  className?: string;
}

export function Spinner({ size = 32, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="טוען"
      className={cn('inline-block rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin', className)}
      style={{ width: size, height: size }}
    />
  );
}

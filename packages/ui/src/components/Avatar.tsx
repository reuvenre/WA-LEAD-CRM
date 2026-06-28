import { cn } from '../cn';

export type AvatarTone = 'brand' | 'amber' | 'slate';

const TONES: Record<AvatarTone, string> = {
  brand: 'bg-brand-100 text-brand-700',
  amber: 'bg-amber-400/20 text-amber-300',
  slate: 'bg-slate-200 text-slate-600',
};

export interface AvatarProps {
  name?: string;
  tone?: AvatarTone;
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/** Initial-circle avatar. */
export function Avatar({ name, tone = 'brand', size = 36, className }: AvatarProps) {
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full font-bold flex-shrink-0', TONES[tone], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {(name?.[0] ?? '?').toUpperCase()}
    </span>
  );
}

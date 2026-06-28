import type { ReactNode } from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import { Stat } from './Stat';
import { cn } from '../cn';

export interface ListingCardProps {
  title: string;
  subtitle?: string;
  address?: string;
  price: number;
  rooms: number;
  floor?: number;
  totalFloors?: number;
  sizeSqm: number;
  /** Source label, e.g. "Yad2" / "Madlan". */
  source?: string;
  /** "פרטי" | "בתיווך" — coloured emerald / indigo. */
  listedBy?: string;
  /** Direct link to the original ad; opens in a new tab. */
  sourceUrl?: string;
  /** Optional external-link icon (decorative). */
  linkIcon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

const fmt = (n: number) => n.toLocaleString('he-IL');

/** Resale listing card — the flagship real-estate component (composes Card + Badge + Stat). */
export function ListingCard({
  title, subtitle, address, price, rooms, floor, totalFloors, sizeSqm,
  source, listedBy, sourceUrl, linkIcon, onClick, className,
}: ListingCardProps) {
  const floorLabel = floor === 0 ? 'קרקע' : totalFloors ? `${floor} מתוך ${totalFloors}` : floor ?? '—';
  return (
    <Card onClick={onClick} className={cn('p-4', className)}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="פתח את המודעה המקורית"
            className="text-slate-300 hover:text-brand-600 transition flex-shrink-0"
          >
            {linkIcon ?? '↗'}
          </a>
        )}
      </div>

      {address && <p className="text-xs text-slate-500 mb-2">{address}</p>}

      <div className="flex items-baseline justify-between mb-3">
        <span className="text-base font-bold text-slate-900">₪{fmt(price)}</span>
        {sizeSqm > 0 && <span className="text-xs text-slate-400">₪{fmt(Math.round(price / sizeSqm))}/מ״ר</span>}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="חדרים" value={rooms} />
        <Stat label="קומה" value={floorLabel} />
        <Stat label="מ״ר" value={sizeSqm} />
      </div>

      {(source || listedBy) && (
        <div className="flex items-center gap-1.5">
          {source && <Badge tone="amber">{source}</Badge>}
          {listedBy && <Badge tone={listedBy === 'פרטי' ? 'emerald' : 'indigo'}>{listedBy}</Badge>}
        </div>
      )}
    </Card>
  );
}

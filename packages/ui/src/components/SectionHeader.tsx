import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned actions (buttons, filters). */
  actions?: ReactNode;
}

/** Page / section title row with optional subtitle and actions. */
export function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm mt-0.5 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

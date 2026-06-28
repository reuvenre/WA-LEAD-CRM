import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional call-to-action (e.g. a Button). */
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-400">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center text-slate-300">{icon}</div>
      )}
      <div>
        <p className="text-base font-semibold text-slate-500">{title}</p>
        {description && <p className="text-sm mt-1 text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

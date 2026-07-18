import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Avatar } from './Avatar';

export interface SidebarItem {
  key: string;
  label: string;
  /** Optional icon element (e.g. a lucide-react icon). */
  icon?: ReactNode;
  /** Dim the item and let the click signal an upgrade intent (e.g. a paid feature). */
  locked?: boolean;
  /** Trailing element pinned to the far edge (e.g. a lock badge). */
  trailing?: ReactNode;
}

export interface SidebarProps {
  brandLabel?: string;
  brandSubLabel?: string;
  /** Logo mark. Falls back to `logoText` in a brand-coloured tile when omitted. */
  logo?: ReactNode;
  logoText?: string;
  user?: { name?: string; role?: string };
  /** Highlight the user block in amber (e.g. for a super-admin). */
  highlightUser?: boolean;
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Footer action buttons (settings / logout / etc.). */
  footer?: ReactNode;
  className?: string;
}

/** The navy navigation rail (generalized from the app's AppSidebar). */
export function Sidebar({
  brandLabel = 'Real Estate Lead',
  brandSubLabel,
  logo,
  logoText = 'RE',
  user,
  highlightUser,
  items,
  activeKey,
  onSelect,
  footer,
  className,
}: SidebarProps) {
  return (
    <aside dir="rtl" className={cn('w-[220px] flex-shrink-0 flex flex-col h-screen bg-navy text-white', className)}>
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4 border-b border-white/10">
        {logo ?? (
          <div className="w-8 h-8 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {logoText}
          </div>
        )}
        <div className="leading-tight min-w-0">
          <div className="text-white font-bold text-[15px]">{brandLabel}</div>
          {brandSubLabel && <div className="text-brand-400 text-[11px] mt-0.5">{brandSubLabel}</div>}
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
          <Avatar name={user.name} tone={highlightUser ? 'amber' : 'brand'} size={36} />
          <div className="overflow-hidden">
            <div className="text-white text-[13px] font-semibold truncate">{user.name ?? 'משתמש'}</div>
            {user.role && (
              <div className={cn('text-[11px]', highlightUser ? 'text-amber-300' : 'text-brand-400')}>{user.role}</div>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 px-2 py-2.5 flex flex-col gap-0.5 overflow-y-auto">
        {items.map((it) => {
          const active = it.key === activeKey;
          return (
            <button
              key={it.key}
              onClick={() => onSelect(it.key)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors text-right',
                active ? 'bg-brand-600 text-white'
                  : it.locked ? 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white',
              )}
            >
              {it.icon}
              <span className={cn(it.locked && 'opacity-90')}>{it.label}</span>
              {it.trailing && <span className="mr-auto flex items-center">{it.trailing}</span>}
            </button>
          );
        })}
      </nav>

      {footer && <div className="px-2 pb-4 pt-2 border-t border-white/10 flex flex-col gap-0.5">{footer}</div>}
    </aside>
  );
}

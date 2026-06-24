'use client';

import {
  LayoutDashboard, Building2, Home, Building, KeyRound, GitBranch,
  CalendarDays, MessageSquare, FolderKanban, Settings as SettingsIcon,
  Shield, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/auth';

export type ViewMode =
  | 'chat' | 'kanban' | 'dashboard' | 'projects' | 'calendar'
  | 'deals' | 'properties' | 're_projects' | 'listings';

type NavItem = { view: ViewMode; label: string; icon: typeof LayoutDashboard };

// Mirrors the demo's navy sidebar — both the CRM world (chat/pipeline/leads) and
// the real-estate world (deals/properties/projects/listings) in one nav.
const NAV: NavItem[] = [
  { view: 'dashboard',   label: 'לוח בקרה',     icon: LayoutDashboard },
  { view: 'deals',       label: 'עסקאות',       icon: Building2 },
  { view: 'properties',  label: 'נכסים',        icon: Home },
  { view: 're_projects', label: 'פרויקטים',     icon: Building },
  { view: 'listings',    label: 'דירות למכירה', icon: KeyRound },
  { view: 'kanban',      label: 'פייפליין',     icon: GitBranch },
  { view: 'calendar',    label: 'יומן פגישות',  icon: CalendarDays },
  { view: 'chat',        label: 'WhatsApp',      icon: MessageSquare },
  { view: 'projects',    label: 'לוחות לידים',  icon: FolderKanban },
];

export function AppSidebar({
  viewMode, onSelect, userName, role, isSuperAdmin, onSettings, onSuperAdmin, onLogout,
}: {
  viewMode: ViewMode;
  onSelect: (v: ViewMode) => void;
  userName?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';
  isSuperAdmin: boolean;
  onSettings: () => void;
  onSuperAdmin: () => void;
  onLogout: () => void;
}) {
  const roleLabel = role ? ROLE_LABELS[role] ?? role : '';

  return (
    <aside dir="rtl" className="w-[220px] flex-shrink-0 flex flex-col h-screen bg-navy text-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          RE
        </div>
        <div className="leading-tight">
          <div className="text-white font-bold text-sm">Real Estate</div>
          <div className="text-brand-400 text-[11px]">ניהול נדל״ן</div>
        </div>
      </div>

      {/* User */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
          isSuperAdmin ? 'bg-amber-400/20 text-amber-300' : 'bg-brand-400/20 text-brand-200',
        )}>
          {userName?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="overflow-hidden">
          <div className="text-white text-[13px] font-semibold truncate">{userName ?? 'משתמש'}</div>
          <div className={cn('text-[11px]', isSuperAdmin ? 'text-amber-300' : 'text-brand-400')}>{roleLabel}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2.5 flex flex-col gap-0.5 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">תפריט</div>
        {NAV.map(({ view, label, icon: Icon }) => {
          const active = viewMode === view;
          return (
            <button
              key={view}
              onClick={() => onSelect(view)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors text-right',
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="px-2 pb-4 pt-2 border-t border-white/10 flex flex-col gap-0.5">
        {isSuperAdmin && (
          <button
            onClick={onSuperAdmin}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-amber-300 hover:bg-white/10 transition-colors"
          >
            <Shield size={16} className="flex-shrink-0" />
            ניהול מערכת
          </button>
        )}
        <button
          onClick={onSettings}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <SettingsIcon size={16} className="flex-shrink-0" />
          הגדרות
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-slate-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
        >
          <LogOut size={16} className="flex-shrink-0" />
          התנתק
        </button>
      </div>
    </aside>
  );
}

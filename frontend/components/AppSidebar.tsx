'use client';

import {
  LayoutDashboard, Building2, Home, Building, KeyRound, GitBranch,
  CalendarDays, MessageSquare, FolderKanban, Settings as SettingsIcon,
  Shield, LogOut, Users, Megaphone, Lock,
} from 'lucide-react';
import { Sidebar } from '@wa-lead/ui';
import { ROLE_LABELS } from '@/lib/auth';
import { openUpgrade } from '@/lib/upgrade';

export type ViewMode =
  | 'chat' | 'kanban' | 'dashboard' | 'projects' | 'calendar'
  | 'deals' | 'properties' | 're_projects' | 'listings' | 'clients' | 'campaigns'
  | 'upgrade';

// Both the CRM world (chat/pipeline/leads) and the real-estate world
// (deals/properties/projects/listings) in one nav.
const NAV: { view: ViewMode; label: string; icon: typeof LayoutDashboard }[] = [
  { view: 'dashboard',   label: 'לוח בקרה',     icon: LayoutDashboard },
  { view: 'deals',       label: 'עסקאות',       icon: Building2 },
  { view: 'properties',  label: 'נכסים',        icon: Home },
  { view: 're_projects', label: 'פרויקטים',     icon: Building },
  { view: 'listings',    label: 'דירות יד שניה', icon: KeyRound },
  { view: 'clients',     label: 'לקוחות',       icon: Users },
  { view: 'kanban',      label: 'פייפליין',     icon: GitBranch },
  { view: 'calendar',    label: 'יומן פגישות',  icon: CalendarDays },
  { view: 'chat',        label: 'WhatsApp',      icon: MessageSquare },
  { view: 'campaigns',   label: 'קמפיינים',     icon: Megaphone },
  { view: 'projects',    label: 'לוחות לידים',  icon: FolderKanban },
];

const footerBtn = 'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors';

export function AppSidebar({
  viewMode, onSelect, userName, role, features, isSuperAdmin, onSettings, onSuperAdmin, onLogout,
}: {
  viewMode: ViewMode;
  onSelect: (v: ViewMode) => void;
  userName?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'AGENT';
  features?: Record<string, boolean> | null;
  isSuperAdmin: boolean;
  onSettings: () => void;
  onSuperAdmin: () => void;
  onLogout: () => void;
}) {
  const roleLabel = role ? ROLE_LABELS[role] ?? role : '';
  // Paid-upgrade modules. `listings` (דירות יד שניה) is off for all tiers today.
  const gated: Partial<Record<ViewMode, string>> = { listings: 'listings', campaigns: 'broadcast' };
  // Manager-only nav items (agents get a 403 from the backend anyway).
  const managerOnly: ViewMode[] = ['campaigns'];
  const items = NAV
    // Agents never see manager-only items; that's a role boundary, not an upsell.
    .filter(({ view }) => !(managerOnly.includes(view) && role === 'AGENT'))
    .map(({ view, label, icon: Icon }) => {
      const feat = gated[view];
      // Show gated items LOCKED (dimmed + lock badge) rather than hiding them, so the
      // user sees what a paid plan unlocks. Clicking a locked item opens the upgrade
      // modal instead of navigating.
      const locked = Boolean(feat) && !(features ? Boolean(features[feat!]) : false);
      return {
        key: view,
        label,
        icon: <Icon size={16} className="flex-shrink-0" />,
        locked,
        trailing: locked ? <Lock size={13} className="text-slate-500" /> : undefined,
      };
    });

  return (
    <Sidebar
      brandLabel="Real Estate Lead CRM"
      brandSubLabel="מבית WIN SOLUTIONS"
      logo={
        // The building mark (not the full badge) — the wordmark is illegible at 32px.
        // White tile keeps the dark linework readable on the navy rail.
        <span className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.png" alt="Real Estate Lead CRM" className="w-full h-full object-contain" />
        </span>
      }
      user={{ name: userName, role: roleLabel }}
      highlightUser={isSuperAdmin}
      items={items}
      activeKey={viewMode}
      onSelect={(k) => {
        // Clicking a plan-locked item opens the upgrade prompt instead of navigating.
        const feat = gated[k as ViewMode];
        const locked = Boolean(feat) && !(features ? Boolean(features[feat!]) : false);
        if (locked) { openUpgrade({ reason: 'feature', feature: feat }); return; }
        onSelect(k as ViewMode);
      }}
      footer={
        <>
          {isSuperAdmin && (
            <button onClick={onSuperAdmin} className={`${footerBtn} text-amber-300 hover:bg-white/10`}>
              <Shield size={16} className="flex-shrink-0" />
              ניהול מערכת
            </button>
          )}
          <button onClick={onSettings} className={`${footerBtn} text-slate-400 hover:bg-white/10 hover:text-white`}>
            <SettingsIcon size={16} className="flex-shrink-0" />
            הגדרות
          </button>
          <button onClick={onLogout} className={`${footerBtn} text-slate-400 hover:bg-red-500/20 hover:text-red-300`}>
            <LogOut size={16} className="flex-shrink-0" />
            התנתק
          </button>
        </>
      }
    />
  );
}

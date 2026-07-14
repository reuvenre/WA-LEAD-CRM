'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Users, Flame, CheckCircle, TrendingUp, MessageCircle, Clock, BarChart2, UserCircle, Building2, FolderKanban,
} from 'lucide-react';
import { api } from '@/lib/api';
import { decodeToken, ROLE_LABELS } from '@/lib/auth';
import type { AnalyticsOverview } from '@/types';
import { cn } from '@/lib/utils';

interface DashboardProps {
  onClose: () => void;
  prefetchedData?: AnalyticsOverview | null;
}

export function Dashboard({ onClose, prefetchedData }: DashboardProps) {
  const [data, setData] = useState<AnalyticsOverview | null>(prefetchedData ?? null);
  const [loading, setLoading] = useState(!prefetchedData);
  const user = decodeToken();

  useEffect(() => {
    if (prefetchedData) { setData(prefetchedData); setLoading(false); return; }
    // On failure (network, 403 for a plan without analytics) stop loading and fall
    // through to the empty state instead of spinning the skeleton forever.
    api.analytics.overview().then((d) => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, [prefetchedData]);

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';

  return (
    <div className="flex flex-col h-full bg-surface-muted overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-surface-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-brand-600" />
          <h2 className="text-base font-bold text-slate-800">WA Lead CRM — דשבורד ביצועים</h2>
        </div>

        {/* User info — top left corner */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 bg-surface-muted rounded-xl px-3 py-1.5 border border-surface-border">
              <UserCircle className="w-4 h-4 text-brand-500 flex-shrink-0" />
              <div className="text-right leading-tight">
                <p className="text-xs font-semibold text-slate-700">{user.username}</p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Building2 className="w-2.5 h-2.5" />
                  {user.tenantName} · {roleLabel}
                </p>
              </div>
            </div>
          )}
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 transition">
            חזרה לשיחות
          </button>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : data ? (
        <div className="p-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="סה״כ לידים" value={data.totals.leads} icon={<Users className="w-5 h-5" />} color="blue" />
            <KpiCard label="חדשים היום" value={data.totals.newToday} icon={<TrendingUp className="w-5 h-5" />} color="purple" />
            <KpiCard label="לידים חמים" value={data.totals.hot} icon={<Flame className="w-5 h-5" />} color="red" />
            <KpiCard label="עסקאות סגורות" value={data.totals.closed} icon={<CheckCircle className="w-5 h-5" />} color="green" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="הודעות היום" value={data.messages.today} icon={<MessageCircle className="w-5 h-5" />} color="blue" small />
            <KpiCard label="הודעות השבוע" value={data.messages.thisWeek} icon={<MessageCircle className="w-5 h-5" />} color="blue" small />
            <KpiCard
              label="זמן מענה ממוצע"
              value={data.avgResponseMinutes != null ? `${data.avgResponseMinutes} דק'` : 'N/A'}
              icon={<Clock className="w-5 h-5" />}
              color="amber"
              small
            />
            <KpiCard
              label={`עמידה ב-SLA (${data.slaTargetMinutes} ד')`}
              value={data.slaCompliance != null ? `${data.slaCompliance}%` : 'N/A'}
              icon={<CheckCircle className="w-5 h-5" />}
              color={data.slaCompliance == null ? 'blue' : data.slaCompliance >= 80 ? 'green' : data.slaCompliance >= 50 ? 'amber' : 'red'}
              small
            />
          </div>

          {/* Agents + Status side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Agents list */}
            <div className="bg-white rounded-xl border border-surface-border p-5 shadow-soft">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm flex items-center gap-1.5">
                <Users className="w-4 h-4 text-brand-500" />
                נציגים ולידים משויכים
              </h3>
              {data.agents.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">אין לידים משויכים לנציגים עדיין</p>
              ) : (
                <div className="space-y-2.5">
                  {data.agents.map((agent) => {
                    const maxLeads = Math.max(...data.agents.map((a) => a.leads), 1);
                    const pct = Math.round((agent.leads / maxLeads) * 100);
                    return (
                      <div key={agent.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {agent.name.charAt(0).toUpperCase()}
                            </span>
                            {agent.name}
                          </span>
                          <span className="flex items-center gap-2">
                            {agent.avgResponseMinutes != null && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title="זמן מענה ממוצע">
                                <Clock className="w-3 h-3" />{agent.avgResponseMinutes}ד'
                              </span>
                            )}
                            {agent.slaCompliance != null && (
                              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                agent.slaCompliance >= 80 ? 'bg-green-50 text-green-600' : agent.slaCompliance >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500')}
                                title="עמידה ביעד ה-SLA">
                                {agent.slaCompliance}%
                              </span>
                            )}
                            <span className="text-xs font-semibold text-brand-600">{agent.leads} לידים</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                          <div className="h-full bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status breakdown */}
            <div className="bg-white rounded-xl border border-surface-border p-5 shadow-soft">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm">התפלגות לפי סטטוס</h3>
              <div className="space-y-3">
                {STATUS_BARS.map((s) => {
                  const item = data.leadsByStatus.find((x) => x.status === s.key);
                  const count = item?.count ?? 0;
                  const pct = data.totals.leads > 0 ? Math.round((count / data.totals.leads) * 100) : 0;
                  return (
                    <div key={s.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600 font-medium">{s.label}</span>
                        <span className="text-xs text-slate-500">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', s.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Weekly activity */}
          {data.leadsThisWeek.length > 0 && (
            <div className="bg-white rounded-xl border border-surface-border p-5 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-brand-500" />
                  לידים חדשים השבוע
                </h3>
                <span className="text-xs text-slate-400 bg-surface-subtle px-2 py-0.5 rounded-full">
                  סה״כ {data.leadsThisWeek.reduce((s, d) => s + d.count, 0)}
                </span>
              </div>
              <div className="flex items-end gap-3" style={{ height: '140px' }}>
                {data.leadsThisWeek.map((d) => {
                  const max = Math.max(...data.leadsThisWeek.map((x) => x.count), 1);
                  const h = Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 8 : 3);
                  const dayName = new Date(d.day).toLocaleDateString('he-IL', { weekday: 'short' });
                  const isToday = new Date(d.day).toDateString() === new Date().toDateString();
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <span className={cn(
                        'text-xs font-bold transition-all',
                        d.count > 0 ? 'text-brand-600' : 'text-slate-300'
                      )}>{d.count}</span>
                      <div className="w-full flex items-end justify-center" style={{ height: '90px' }}>
                        <div className={cn(
                          'w-full rounded-lg transition-all duration-300 group-hover:opacity-90',
                          isToday
                            ? 'bg-gradient-to-t from-brand-600 to-brand-400 shadow-sm'
                            : d.count > 0
                              ? 'bg-gradient-to-t from-brand-400 to-brand-300'
                              : 'bg-slate-100'
                        )} style={{ height: `${h}%` }} />
                      </div>
                      <span className={cn(
                        'text-[11px] font-medium px-1.5 py-0.5 rounded-md transition-all',
                        isToday
                          ? 'bg-brand-100 text-brand-700 font-bold'
                          : 'text-slate-500'
                      )}>{dayName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projects */}
          {data.projects.length > 0 && (
            <div className="bg-white rounded-xl border border-surface-border p-5 shadow-soft">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4 text-brand-500" />
                פרויקטים
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.projects.map((proj) => (
                  <div key={proj.id} className="rounded-xl border border-surface-border p-3 space-y-2 hover:shadow-sm transition">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />
                      <span className="text-sm font-semibold text-slate-800 truncate">{proj.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500">{proj.leads} לידים</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversion rate */}
          <div className="bg-white rounded-xl border border-surface-border p-5 shadow-soft">
            <h3 className="font-semibold text-slate-700 mb-3 text-sm">שיעורי המרה</h3>
            <div className="grid grid-cols-2 gap-4">
              <ConversionStat
                label="אחוז סגירה"
                value={data.totals.leads > 0 ? `${Math.round((data.totals.closed / data.totals.leads) * 100)}%` : '0%'}
                color="text-green-600"
              />
              <ConversionStat
                label="אחוז הפסד"
                value={data.totals.leads > 0 ? `${Math.round((data.totals.lost / data.totals.leads) * 100)}%` : '0%'}
                color="text-red-500"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 p-8 text-center">
          <BarChart2 className="w-10 h-10 text-slate-300" />
          <p className="text-sm">לא ניתן לטעון את נתוני הדשבורד כרגע.</p>
          <p className="text-xs">ייתכן שהתכונה אינה זמינה במסלול הנוכחי, או שיש בעיית רשת זמנית.</p>
        </div>
      )}
    </div>
  );
}

// ─── Prefetch hook — call this in parent so data loads before user clicks Dashboard ──
export function usePrefetchDashboard(active: boolean) {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (!active || fetched.current) return;
    fetched.current = true;
    api.analytics.overview().then(setData).catch(() => {});
  }, [active]);

  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-red-50 text-red-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  amber: 'bg-amber-50 text-amber-600',
};

function KpiCard({ label, value, icon, color, small }: {
  label: string; value: string | number; icon: React.ReactNode;
  color: keyof typeof COLOR_MAP; small?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-border p-4 shadow-soft">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', COLOR_MAP[color])}>{icon}</div>
      <div className={cn('font-bold text-slate-800', small ? 'text-xl' : 'text-2xl')}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function ConversionStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center p-3 bg-surface-muted rounded-lg">
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

const STATUS_BARS = [
  { key: 'NEW', label: 'חדש', color: 'bg-blue-500' },
  { key: 'IN_PROGRESS', label: 'בטיפול', color: 'bg-amber-500' },
  { key: 'HOT', label: 'חם', color: 'bg-red-500' },
  { key: 'CLOSED', label: 'סגור', color: 'bg-green-500' },
  { key: 'LOST', label: 'הפסד', color: 'bg-slate-400' },
];

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-white rounded-xl border border-surface-border" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-white rounded-xl border border-surface-border" />
        <div className="h-48 bg-white rounded-xl border border-surface-border" />
      </div>
      <div className="h-32 bg-white rounded-xl border border-surface-border" />
    </div>
  );
}

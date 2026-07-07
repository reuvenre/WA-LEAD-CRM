'use client';

import { useState, useEffect } from 'react';
import {
  X, Building2, Users, Shield, ToggleLeft, ToggleRight, Trash2, KeyRound,
  AlertCircle, CheckCircle, Eye, EyeOff, ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('crm_token') ?? '' : '';
}

async function adminFetch(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return { ok: true, data: null };
  return { ok: res.ok, data: await res.json() };
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  active: boolean;
  createdAt: string;
  greenApiInstanceId: string | null;
  _count: { users: number; leads: number };
}

interface TenantUser {
  id: string;
  username: string;
  role: string;
  active: boolean;
  createdAt: string;
}

interface Stats {
  totalTenants: number;
  activeTenants: number;
  totalLeads: number;
  totalMessages: number;
}

interface SuperAdminPanelProps {
  onClose: () => void;
}

export function SuperAdminPanel({ onClose }: SuperAdminPanelProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [tenantUsers, setTenantUsers] = useState<Record<string, TenantUser[]>>({});
  const [resetModal, setResetModal] = useState<{ userId: string; username: string } | null>(null);

  useEffect(() => {
    Promise.all([
      adminFetch('/api/super-admin/tenants'),
      adminFetch('/api/super-admin/stats'),
    ]).then(([t, s]) => {
      if (t.ok) setTenants(t.data as Tenant[]);
      if (s.ok) setStats(s.data as Stats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadTenantUsers = async (tenantId: string) => {
    if (tenantUsers[tenantId]) return;
    const { ok, data } = await adminFetch(`/api/super-admin/tenants/${tenantId}/users`);
    if (ok) setTenantUsers(prev => ({ ...prev, [tenantId]: data as TenantUser[] }));
  };

  const handleExpandTenant = (tenantId: string) => {
    if (expandedTenant === tenantId) {
      setExpandedTenant(null);
    } else {
      setExpandedTenant(tenantId);
      loadTenantUsers(tenantId);
    }
  };

  const handleToggleTenantActive = async (tenant: Tenant) => {
    const { ok } = await adminFetch(`/api/super-admin/tenants/${tenant.id}`, 'PATCH', { active: !tenant.active });
    if (ok) setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, active: !t.active } : t));
  };

  const handleChangePlan = async (tenant: Tenant, plan: string) => {
    const { ok } = await adminFetch(`/api/super-admin/tenants/${tenant.id}`, 'PATCH', { plan });
    if (ok) setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, plan } : t));
  };

  const handleToggleUserActive = async (tenantId: string, user: TenantUser) => {
    const { ok } = await adminFetch(`/api/super-admin/users/${user.id}`, 'PATCH', { active: !user.active });
    if (ok) {
      setTenantUsers(prev => ({
        ...prev,
        [tenantId]: prev[tenantId].map(u => u.id === user.id ? { ...u, active: !u.active } : u),
      }));
    }
  };

  const handleDeleteUser = async (tenantId: string, userId: string) => {
    if (!confirm('האם למחוק את המשתמש? פעולה זו בלתי הפיכה.')) return;
    const { ok } = await adminFetch(`/api/super-admin/users/${userId}`, 'DELETE');
    if (ok) {
      setTenantUsers(prev => ({
        ...prev,
        [tenantId]: prev[tenantId].filter(u => u.id !== userId),
      }));
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm('האם למחוק את הלקוח וכל הנתונים שלו? פעולה זו בלתי הפיכה!')) return;
    const { ok } = await adminFetch(`/api/super-admin/tenants/${tenantId}`, 'DELETE');
    if (ok) setTenants(prev => prev.filter(t => t.id !== tenantId));
  };

  const planLabels: Record<string, string> = { TRIAL: 'ניסיון', BASIC: 'בסיסי', PRO: 'מקצועי', ENTERPRISE: 'ארגוני' };
  const roleLabels: Record<string, string> = { SUPER_ADMIN: 'מנהל-על', ADMIN: 'מנהל', AGENT: 'נציג' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-slate-800 text-base">ניהול מערכת — Super Admin</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">טוען...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="לקוחות" value={stats.totalTenants} color="blue" />
                <StatCard label="פעילים" value={stats.activeTenants} color="green" />
                <StatCard label="לידים" value={stats.totalLeads} color="purple" />
                <StatCard label="הודעות" value={stats.totalMessages} color="amber" />
              </div>
            )}

            {/* Tenants list */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-brand-500" />
                לקוחות ({tenants.length})
              </h3>

              {tenants.map((tenant) => (
                <div key={tenant.id} className={cn(
                  'border rounded-xl transition',
                  tenant.active ? 'border-surface-border bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
                )}>
                  {/* Tenant row */}
                  <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => handleExpandTenant(tenant.id)}>
                    <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-bold flex-shrink-0">
                      {tenant.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate">{tenant.name}</p>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                          tenant.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        )}>
                          {tenant.active ? 'פעיל' : 'מושבת'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {tenant.email} · {planLabels[tenant.plan] ?? tenant.plan} · {tenant._count.users} משתמשים · {tenant._count.leads} לידים
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Plan switcher — flip a tenant's plan to test each tier */}
                      <select
                        value={tenant.plan}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleChangePlan(tenant, e.target.value)}
                        title="שנה מסלול"
                        className="text-[11px] rounded-md border border-slate-200 bg-white px-1.5 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="TRIAL">ניסיון</option>
                        <option value="BASIC">בסיסי</option>
                        <option value="PRO">מקצועי</option>
                      </select>
                      <button onClick={(e) => { e.stopPropagation(); handleToggleTenantActive(tenant); }}
                        className={cn('transition', tenant.active ? 'text-green-500 hover:text-red-500' : 'text-slate-300 hover:text-green-500')}
                        title={tenant.active ? 'השבת לקוח' : 'הפעל לקוח'}>
                        {tenant.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTenant(tenant.id); }}
                        className="text-slate-300 hover:text-red-500 transition" title="מחק לקוח">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expandedTenant === tenant.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded users */}
                  {expandedTenant === tenant.id && (
                    <div className="border-t border-surface-border px-4 py-3 bg-slate-50/50 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> משתמשים
                      </p>
                      {tenantUsers[tenant.id] ? (
                        tenantUsers[tenant.id].length === 0 ? (
                          <p className="text-xs text-slate-400">אין משתמשים</p>
                        ) : (
                          tenantUsers[tenant.id].map((user) => (
                            <div key={user.id} className={cn(
                              'flex items-center gap-3 p-2.5 rounded-lg border transition',
                              user.active ? 'border-surface-border bg-white' : 'border-slate-200 bg-slate-100 opacity-60'
                            )}>
                              <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 text-[11px] font-bold flex-shrink-0">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-700">{user.username}</p>
                                <p className="text-[10px] text-slate-400">
                                  {roleLabels[user.role] ?? user.role} · {user.active ? 'פעיל' : 'לא פעיל'} · {new Date(user.createdAt).toLocaleDateString('he-IL')}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setResetModal({ userId: user.id, username: user.username })}
                                  className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition" title="אפס סיסמה">
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleToggleUserActive(tenant.id, user)}
                                  className={cn('transition', user.active ? 'text-green-500 hover:text-red-500' : 'text-slate-300 hover:text-green-500')}
                                  title={user.active ? 'השבת' : 'הפעל'}>
                                  {user.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                </button>
                                <button onClick={() => handleDeleteUser(tenant.id, user.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition" title="מחק">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )
                      ) : (
                        <p className="text-xs text-slate-400">טוען...</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetModal && (
        <ResetPasswordModal
          userId={resetModal.userId}
          username={resetModal.username}
          onClose={() => setResetModal(null)}
        />
      )}
    </div>
  );
}

function ResetPasswordModal({ userId, username, onClose }: { userId: string; username: string; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) { setError('סיסמה חייבת להיות לפחות 6 תווים'); return; }
    setLoading(true); setError('');
    const { ok, data } = await adminFetch(`/api/super-admin/users/${userId}/reset-password`, 'POST', { newPassword });
    setLoading(false);
    if (ok) setSuccess(true);
    else setError((data as { error?: string })?.error ?? 'שגיאה באיפוס');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-5 space-y-4" dir="rtl">
        {success ? (
          <div className="text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-bold text-green-700 text-sm">הסיסמה אופסה בהצלחה!</p>
            <p className="text-xs text-slate-500">למשתמש: {username}</p>
            <button onClick={onClose}
              className="w-full py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition">
              סגור
            </button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <KeyRound className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-sm">איפוס סיסמה</h3>
              <p className="text-xs text-slate-500 mt-1">למשתמש: <strong>{username}</strong></p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">סיסמה חדשה</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="לפחות 6 תווים..."
                  dir="ltr"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition pr-3 pl-10"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-slate-600 transition">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3 h-3" />{error}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleReset} disabled={loading || !newPassword}
                className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50">
                {loading ? 'מאפס...' : 'אפס סיסמה'}
              </button>
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition">
                ביטול
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-xl border border-surface-border p-3 text-center shadow-soft">
      <div className={cn('text-xl font-bold', colors[color]?.split(' ')[1] ?? 'text-slate-800')}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, Lock, CheckCircle, AlertCircle, Eye, EyeOff, Wifi, Check, UserCircle, Building2, Mail, Users, Plus, ToggleLeft, ToggleRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('crm_token') ?? '' : '';
}

async function authFetch(path: string, body?: object, method?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: body ? (method ?? 'POST') : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { ok: res.ok, data: await res.json() };
}

interface SettingsModalProps { onClose: () => void; }

type Tab = 'profile' | 'agents' | '2fa' | 'password' | 'green-api' | 'google';

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="font-bold text-slate-800 text-base">הגדרות</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-surface-border">
          <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')} icon={<UserCircle className="w-3.5 h-3.5" />} label="פרופיל" />
          <TabBtn active={tab === 'agents'} onClick={() => setTab('agents')} icon={<Users className="w-3.5 h-3.5" />} label="נציגים" />
          <TabBtn active={tab === 'green-api'} onClick={() => setTab('green-api')} icon={<Wifi className="w-3.5 h-3.5" />} label="Green API" />
          <TabBtn active={tab === 'google'} onClick={() => setTab('google')} icon={<CalendarDays className="w-3.5 h-3.5" />} label="יומן" />
          <TabBtn active={tab === '2fa'} onClick={() => setTab('2fa')} icon={<ShieldCheck className="w-3.5 h-3.5" />} label="2FA" />
          <TabBtn active={tab === 'password'} onClick={() => setTab('password')} icon={<Lock className="w-3.5 h-3.5" />} label="סיסמה" />
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {tab === 'profile' && <ProfileSettings />}
          {tab === 'agents' && <AgentsManagement />}
          {tab === 'green-api' && <GreenApiSettings />}
          {tab === 'google' && <GoogleCalendarSettings />}
          {tab === '2fa' && <TwoFactorSetup />}
          {tab === 'password' && <ChangePassword onDone={onClose} />}
        </div>
      </div>
    </div>
  );
}

// ─── Profile Settings ─────────────────────────────────────────────────────────
function ProfileSettings() {
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    Promise.all([
      api.tenant.settings(),
      authFetch('/api/auth/verify'),
    ]).then(([settings, { data }]) => {
      setTenantName(settings.name ?? '');
      setTenantEmail(settings.email ?? '');
      setPlan(settings.plan ?? '');
      // Get current user info from token
      const token = getToken();
      if (token) {
        try {
          const payload = token.split('.')[1];
          const json = decodeURIComponent(atob(payload).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
          const parsed = JSON.parse(json);
          setUsername(parsed.username ?? '');
          setRole(parsed.role ?? '');
        } catch {}
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!tenantName.trim()) { setError('שם חברה נדרש'); return; }
    if (!tenantEmail.trim()) { setError('אימייל נדרש'); return; }
    setSaving(true); setError(''); setSuccess(false);
    try {
      const { ok, data } = await authFetch('/api/tenant/profile', { name: tenantName.trim(), email: tenantEmail.trim() }, 'PATCH');
      if (!ok) { setError((data as { error?: string }).error ?? 'שגיאה בשמירה'); return; }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">טוען...</div>;

  const roleLabels: Record<string, string> = { SUPER_ADMIN: 'מנהל-על', ADMIN: 'מנהל', AGENT: 'נציג' };

  return (
    <div className="p-6 space-y-4">
      <div className="bg-brand-50 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <UserCircle className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{username}</p>
          <p className="text-xs text-slate-500">{roleLabels[role] ?? role} · {plan === 'TRIAL' ? 'ניסיון' : plan}</p>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
          <Building2 className="w-3 h-3" /> שם החברה
        </label>
        <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)}
          className={inputCls.replace('font-mono', '')} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
          <Mail className="w-3 h-3" /> אימייל
        </label>
        <input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)}
          dir="ltr" className={inputCls} />
      </div>

      {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      <button onClick={handleSave} disabled={saving}
        className={cn('w-full py-2.5 rounded-lg text-white text-sm font-semibold transition', success ? 'bg-green-500' : 'bg-brand-600 hover:bg-brand-700', 'disabled:opacity-50')}>
        {saving ? 'שומר...' : success ? '✓ נשמר!' : 'עדכן פרטים'}
      </button>
    </div>
  );
}

// ─── Agents / Users Management ────────────────────────────────────────────
function AgentsManagement() {
  const [users, setUsers] = useState<Array<{ id: string; username: string; role: string; active: boolean; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('AGENT');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const roleLabels: Record<string, string> = { SUPER_ADMIN: 'מנהל-על', ADMIN: 'מנהל', AGENT: 'נציג' };

  useEffect(() => {
    api.tenant.listUsers().then((u) => { setUsers(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleAddUser = async () => {
    if (!newUsername.trim()) { setAddError('נדרש שם משתמש'); return; }
    if (!newPassword || newPassword.length < 6) { setAddError('סיסמה מינימום 6 תווים'); return; }
    setAddLoading(true); setAddError('');
    try {
      const user = await api.tenant.createUser({ username: newUsername.trim(), password: newPassword, role: newRole }) as { id: string; username: string; role: string; active: boolean; createdAt: string };
      setUsers(prev => [...prev, user]);
      setShowAdd(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('AGENT');
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'שגיאה בהוספת משתמש');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await api.tenant.updateUser(id, { active: !active });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !active } : u));
    } catch {}
  };

  const handleChangeRole = async (id: string, role: string) => {
    try {
      await api.tenant.updateUser(id, { role });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
    } catch {}
  };

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">טוען...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">👥 ניהול נציגים</p>
        <p>הוסף נציגים למערכת והקצה להם לידים לטיפול.</p>
      </div>

      {/* Users list */}
      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.id} className={cn(
            'flex items-center gap-3 p-3 rounded-xl border transition',
            user.active ? 'border-surface-border bg-white' : 'border-slate-200 bg-slate-50 opacity-60'
          )}>
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user.username}</p>
              <p className="text-[10px] text-slate-400">
                {roleLabels[user.role] ?? user.role} · {user.active ? 'פעיל' : 'לא פעיל'}
              </p>
            </div>
            <select
              value={user.role}
              onChange={(e) => handleChangeRole(user.id, e.target.value)}
              className="text-[11px] border border-surface-border rounded-lg px-2 py-1 bg-surface-muted focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ADMIN">מנהל</option>
              <option value="AGENT">נציג</option>
            </select>
            <button onClick={() => handleToggleActive(user.id, user.active)}
              className={cn('transition', user.active ? 'text-green-500 hover:text-red-500' : 'text-slate-300 hover:text-green-500')}>
              {user.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>
        ))}
      </div>

      {/* Add user form */}
      {showAdd ? (
        <div className="space-y-3 p-4 bg-surface-muted rounded-xl border border-surface-border">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">שם משתמש</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
              placeholder="שם משתמש לנציג" dir="ltr"
              className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">סיסמה</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="סיסמה ראשונית" dir="ltr"
              className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">תפקיד</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
              className={inputCls}>
              <option value="AGENT">נציג</option>
              <option value="ADMIN">מנהל</option>
            </select>
          </div>
          {addError && <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2"><AlertCircle className="w-3 h-3" />{addError}</div>}
          <div className="flex gap-2">
            <button onClick={handleAddUser} disabled={addLoading}
              className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50">
              {addLoading ? 'מוסיף...' : 'הוסף נציג'}
            </button>
            <button onClick={() => { setShowAdd(false); setAddError(''); }}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition">
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full py-2.5 rounded-lg border-2 border-dashed border-brand-300 text-brand-600 text-sm font-semibold hover:bg-brand-50 transition flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />
          הוסף נציג חדש
        </button>
      )}
    </div>
  );
}

// ─── Green API Settings ───────────────────────────────────────────────────────
function GreenApiSettings() {
  const [instanceId, setInstanceId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; state: string | null; error?: string } | null>(null);

  const handleTest = async () => {
    if (!instanceId.trim() || !token.trim()) { setError('נדרשים Instance ID ו-Token'); return; }
    setTesting(true); setError(''); setTestResult(null);
    try {
      const result = await api.tenant.testGreenApi({ greenApiInstanceId: instanceId.trim(), greenApiToken: token.trim() });
      setTestResult(result);
    } catch (e: unknown) {
      setTestResult({ ok: false, state: null, error: e instanceof Error ? e.message : 'שגיאה בבדיקה' });
    } finally {
      setTesting(false);
    }
  };

  // Human-readable explanation per Green API instance state
  const stateMessage = (state: string | null): string => {
    switch (state) {
      case 'authorized': return 'המכשיר מאומת ומוכן לשליחת הודעות ✓';
      case 'notAuthorized': return 'ה-instance לא מאומת — סרוק את ה-QR בלוח הבקרה של Green API';
      case 'blocked': return 'ה-instance חסום — בדוק את החשבון ב-Green API';
      case 'starting': return 'ה-instance בתהליך הפעלה — נסה שוב בעוד רגע';
      case 'sleepMode': return 'ה-instance במצב שינה — נסה שוב בעוד רגע';
      case 'yellowCard': return 'ה-instance מוגבל זמנית (yellow card) ב-Green API';
      default: return state ? `מצב לא מוכר: ${state}` : '';
    }
  };

  useEffect(() => {
    api.tenant.settings().then((s) => {
      setInstanceId(s.greenApiInstanceId ?? '');
      setToken(s.greenApiToken ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const webhookUrl = instanceId
    ? `${API_URL}/api/webhook/${instanceId}`
    : '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceId.trim() || !token.trim()) { setError('נדרשים Instance ID ו-Token'); return; }
    setSaving(true); setError(''); setSuccess(false);
    try {
      await api.tenant.updateGreenApi({ greenApiInstanceId: instanceId.trim(), greenApiToken: token.trim(), greenApiWebhookUrl: webhookUrl });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">טוען...</div>;

  return (
    <form onSubmit={handleSave} className="p-6 space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">🟢 Green API — חיבור וואצאפ</p>
        <p>פרטי החיבור נשמרים בענן ומאובטחים. כל לקוח מחובר לחשבון וואצאפ נפרד.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600">Instance ID</label>
        <input type="text" value={instanceId} onChange={(e) => setInstanceId(e.target.value)}
          placeholder="7105XXXXXXXXX" dir="ltr"
          className={inputCls} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600">API Token</label>
        <div className="relative">
          <input type={showToken ? 'text' : 'password'} value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="a14b720..." dir="ltr" autoComplete="off"
            className={inputCls + ' pl-10'} />
          <button type="button" onClick={() => setShowToken((v) => !v)}
            className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-slate-600 transition"
            title={showToken ? 'הסתר' : 'הצג'}>
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {webhookUrl && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Webhook URL (הגדר ב-Green API)</label>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-600 break-all select-all dir-ltr">
            {webhookUrl}
          </div>
        </div>
      )}

      {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      {/* Connection test result */}
      {testResult && (
        <div className={cn('flex items-start gap-2 text-sm rounded-lg px-3 py-2',
          testResult.ok ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50')}>
          {testResult.ok
            ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <span>{testResult.error ? testResult.error : stateMessage(testResult.state)}</span>
        </div>
      )}

      {/* Test connection against Green API */}
      <button type="button" onClick={handleTest} disabled={testing || !instanceId.trim() || !token.trim()}
        className="w-full py-2.5 rounded-lg border border-brand-300 text-brand-600 text-sm font-semibold transition hover:bg-brand-50 disabled:opacity-50 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        {testing ? 'בודק חיבור...' : 'בדוק תקינות מול Green API'}
      </button>

      <button type="submit" disabled={saving}
        className={cn('w-full py-2.5 rounded-lg text-white text-sm font-semibold transition', success ? 'bg-green-500' : 'bg-brand-600 hover:bg-brand-700', 'disabled:opacity-50')}>
        {saving ? 'שומר...' : success ? '✓ נשמר!' : 'שמור הגדרות'}
      </button>
    </form>
  );
}

// ─── Google Calendar ──────────────────────────────────────────────────────────
function GoogleCalendarSettings() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => api.google.status().then((s) => { setStatus(s); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api.google.authUrl();
      window.location.href = url; // redirect to Google consent
    } catch {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try { await api.google.disconnect(); await load(); } finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-center text-slate-400 text-sm">טוען...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-semibold flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> סנכרון יומן Google</p>
        <p>חבר את יומן Google האישי שלך — כל פגישה שתקבע על ליד תיווצר אוטומטית ביומן שלך.</p>
      </div>

      {!status?.configured ? (
        <div className="flex items-start gap-2 text-amber-700 text-sm bg-amber-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>חיבור Google עדיין לא הוגדר בשרת. יש להגדיר <code>GOOGLE_CLIENT_ID</code> ו-<code>GOOGLE_CLIENT_SECRET</code>.</span>
        </div>
      ) : status.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>מחובר{status.email ? ` — ${status.email}` : ''}</span>
          </div>
          <button onClick={disconnect} disabled={busy}
            className="w-full py-2 rounded-lg bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50">
            {busy ? 'מנתק...' : 'נתק את חשבון Google'}
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={busy}
          className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
          <CalendarDays className="w-4 h-4" />
          {busy ? 'מעביר ל-Google...' : 'חבר את יומן Google'}
        </button>
      )}
    </div>
  );
}

// ─── 2FA Setup ────────────────────────────────────────────────────────────────
function TwoFactorSetup() {
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled'>('loading');
  const [setupData, setSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authFetch('/api/auth/2fa/status').then(({ data }) => {
      setStatus((data as { enabled: boolean }).enabled ? 'enabled' : 'disabled');
    });
  }, []);

  const handleStartSetup = async () => {
    setLoading(true);
    const { ok, data } = await authFetch('/api/auth/2fa/setup', {});
    setLoading(false);
    if (ok) setSetupData(data as typeof setupData);
    else setError('שגיאה בהכנת ה-2FA');
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) { setError('הזן קוד בן 6 ספרות'); return; }
    setLoading(true); setError('');
    const { ok, data } = await authFetch('/api/auth/2fa/enable', { code: verifyCode });
    setLoading(false);
    if (ok) { setDone(true); setStatus('enabled'); }
    else setError((data as { error: string }).error ?? 'קוד שגוי');
  };

  const handleDisable = async () => {
    setLoading(true);
    await authFetch('/api/auth/2fa/disable', {});
    setLoading(false);
    setStatus('disabled');
    setSetupData(null);
  };

  if (status === 'loading') return <div className="p-6 text-center text-slate-400 text-sm">טוען...</div>;

  if (done || status === 'enabled') {
    return (
      <div className="p-6 text-center space-y-4">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
        <p className="font-bold text-slate-800">אימות דו-שלבי פעיל</p>
        <p className="text-xs text-slate-500">בכל כניסה תידרש לאמת עם Google Authenticator.</p>
        <button onClick={handleDisable} disabled={loading}
          className="w-full py-2 rounded-lg bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50">
          {loading ? 'מבטל...' : 'בטל אימות דו-שלבי'}
        </button>
      </div>
    );
  }

  if (setupData) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-xs text-slate-600">סרוק את הקוד עם Google Authenticator / Authy, ואז הזן את הקוד שמופיע:</p>
        <div className="flex justify-center">
          <img src={setupData.qrCode} alt="QR Code" className="w-48 h-48 rounded-xl border border-surface-border" />
        </div>
        <input type="text" inputMode="numeric" maxLength={6}
          value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000" dir="ltr"
          className="w-full px-3 py-2.5 text-center text-xl font-bold tracking-widest rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
        {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        <button onClick={handleVerify} disabled={loading || verifyCode.length !== 6}
          className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50">
          {loading ? 'מאמת...' : 'אמת והפעל 2FA'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm text-blue-700">
        <p className="font-semibold">🔐 אימות דו-שלבי (TOTP)</p>
        <p className="text-xs">לאחר ההפעלה, בכל כניסה תצטרך להזין קוד מ-Google Authenticator.</p>
      </div>
      {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      <button onClick={handleStartSetup} disabled={loading}
        className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50">
        {loading ? 'טוען...' : 'הגדר אימות דו-שלבי'}
      </button>
    </div>
  );
}

// ─── Change Password ───────────────────────────────────────────────────────────
const PASSWORD_RULES = [
  { label: 'מינימום 12 תווים', test: (p: string) => p.length >= 12 },
  { label: 'אות גדולה (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'תו מיוחד (!@#$...)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const nextValid = PASSWORD_RULES.every((r) => r.test(next));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextValid) { setError('הסיסמה החדשה אינה עומדת בדרישות'); return; }
    setLoading(true); setError('');
    const { ok, data } = await authFetch('/api/auth/change-password', { currentPassword: current, newPassword: next });
    setLoading(false);
    if (ok) setSuccess(true);
    else setError((data as { error: string }).error ?? 'שגיאה');
  };

  if (success) {
    return (
      <div className="p-6 text-center space-y-4">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
        <p className="font-bold text-green-700">הסיסמה שונתה בהצלחה!</p>
        <button onClick={onDone} className="w-full py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition">סגור</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <PasswordField label="סיסמה נוכחית" value={current} onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} placeholder="הסיסמה הנוכחית" />
      <div className="space-y-1">
        <PasswordField label="סיסמה חדשה" value={next} onChange={setNext} show={showNext} onToggle={() => setShowNext(v => !v)} placeholder="לפחות 12 תווים..." />
        <div className="mt-2 space-y-1.5">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(next);
            return (
              <div key={rule.label} className={cn('flex items-center gap-2 text-xs transition-colors', ok ? 'text-green-600' : 'text-slate-400')}>
                <span className={cn('w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all', ok ? 'bg-green-500' : 'bg-slate-200')}>
                  {ok && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </span>
                {rule.label}
              </div>
            );
          })}
        </div>
      </div>
      {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      <button type="submit" disabled={loading || !current || !nextValid}
        className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50">
        {loading ? 'שומר...' : 'שנה סיסמה'}
      </button>
    </form>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <Lock className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} dir="ltr"
          className="w-full pr-9 pl-10 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
        <button type="button" onClick={onToggle} className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-slate-600 transition">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={cn('flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition', active ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600')}>
      {icon}{label}
    </button>
  );
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition font-mono';

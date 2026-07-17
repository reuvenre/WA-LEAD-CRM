'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, Lock, CheckCircle, AlertCircle, Eye, EyeOff, Wifi, Check, UserCircle, Building2, Mail, Users, Plus, ToggleLeft, ToggleRight, CalendarDays, Trash2, MessageSquareText, Bot, KeyRound, Globe, Copy, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type AutoRepliesConfig } from '@/lib/api';
import { useConfirm } from './useConfirm';
import { usePush } from '@/hooks/usePush';
import { decodeToken } from '@/lib/auth';
import type { Template, AttributeDef } from '@/types';

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

type Tab = 'profile' | 'agents' | 'templates' | '2fa' | 'password' | 'green-api' | 'google' | 'engagement' | 'widget' | 'notifications';

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('profile');
  // Managers (MANAGER/ADMIN/SUPER_ADMIN) get the team/WhatsApp/templates tabs; plain
  // agents only get their personal tabs (profile, calendar, 2FA, password).
  const role = decodeToken()?.role;
  const isManager = role === 'MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="font-bold text-slate-800 text-base">הגדרות</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pill tabs wrap onto as many rows as needed, so each stays fully readable
            instead of nine equal-width flex-1 tabs crushing together in a narrow modal. */}
        <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-surface-border bg-surface-subtle/40">
          <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')} icon={<UserCircle className="w-3.5 h-3.5" />} label="פרופיל" />
          {isManager && <TabBtn active={tab === 'agents'} onClick={() => setTab('agents')} icon={<Users className="w-3.5 h-3.5" />} label="נציגים" />}
          {isManager && <TabBtn active={tab === 'templates'} onClick={() => setTab('templates')} icon={<MessageSquareText className="w-3.5 h-3.5" />} label="תבניות" />}
          {isManager && <TabBtn active={tab === 'engagement'} onClick={() => setTab('engagement')} icon={<Bot className="w-3.5 h-3.5" />} label="אוטומציה" />}
          {isManager && <TabBtn active={tab === 'widget'} onClick={() => setTab('widget')} icon={<Globe className="w-3.5 h-3.5" />} label="צ׳אט לאתר" />}
          {isManager && <TabBtn active={tab === 'green-api'} onClick={() => setTab('green-api')} icon={<Wifi className="w-3.5 h-3.5" />} label="Green API" />}
          <TabBtn active={tab === 'notifications'} onClick={() => setTab('notifications')} icon={<Bell className="w-3.5 h-3.5" />} label="התראות" />
          <TabBtn active={tab === 'google'} onClick={() => setTab('google')} icon={<CalendarDays className="w-3.5 h-3.5" />} label="יומן" />
          <TabBtn active={tab === '2fa'} onClick={() => setTab('2fa')} icon={<ShieldCheck className="w-3.5 h-3.5" />} label="2FA" />
          <TabBtn active={tab === 'password'} onClick={() => setTab('password')} icon={<Lock className="w-3.5 h-3.5" />} label="סיסמה" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'profile' && <ProfileSettings />}
          {tab === 'agents' && <AgentsManagement />}
          {tab === 'templates' && <TemplatesManager />}
          {tab === 'engagement' && <EngagementSettings />}
          {tab === 'widget' && <WidgetSettings />}
          {tab === 'green-api' && <GreenApiSettings />}
          {tab === 'notifications' && <NotificationsSettings />}
          {tab === 'google' && <GoogleCalendarSettings />}
          {tab === '2fa' && <TwoFactorSetup />}
          {tab === 'password' && <ChangePassword onDone={onClose} />}
        </div>
      </div>
    </div>
  );
}

// ─── Push notifications ───────────────────────────────────────────────────────
function NotificationsSettings() {
  const { status, subscribed, busy, enable, disable } = usePush();

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-surface-subtle rounded-xl p-4 text-sm text-slate-600 leading-relaxed">{children}</div>
  );

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-brand-600" />
        <h3 className="text-sm font-bold text-slate-800">התראות דחיפה</h3>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        קבל התראה במכשיר על כל הודעה נכנסת חדשה — גם כשהאפליקציה סגורה.
      </p>

      {status === 'unsupported' && <Row>הדפדפן הנוכחי אינו תומך בהתראות דחיפה.</Row>}
      {status === 'unconfigured' && <Row>התראות הדחיפה אינן מוגדרות במערכת עדיין (נדרשת הגדרת מפתחות VAPID בשרת).</Row>}
      {status === 'ios-a2hs' && (
        <Row>
          ב-iPhone צריך קודם <b>להוסיף את האפליקציה למסך הבית</b> (בשיתוף → &quot;הוסף למסך הבית&quot;), ואז לפתוח אותה משם ולהפעיל התראות. נדרש iOS 16.4 ומעלה.
        </Row>
      )}
      {status === 'denied' && <Row>ההתראות חסומות עבור אתר זה — יש לאפשר אותן בהגדרות הדפדפן ולרענן.</Row>}

      {(status === 'default' || status === 'granted') && (
        subscribed ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4">
            <span className="text-sm text-green-700 font-medium flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> התראות פעילות במכשיר זה</span>
            <button onClick={disable} disabled={busy}
              className="text-xs font-semibold text-slate-600 hover:text-red-600 disabled:opacity-50">כבה</button>
          </div>
        ) : (
          <button onClick={enable} disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
            <Bell className="w-4 h-4" /> {busy ? 'מפעיל…' : 'הפעל התראות במכשיר זה'}
          </button>
        )
      )}
    </div>
  );
}

// ─── Website chat widget ──────────────────────────────────────────────────────
function WidgetSettings() {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('צ׳אט עם נציג');
  const [greeting, setGreeting] = useState('שלום! איך נוכל לעזור? 🙂');
  const [color, setColor] = useState('#25D366');
  const [snippet, setSnippet] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.tenant.widget.get().then((w) => {
      setAvailable(w.available);
      setEnabled(w.enabled);
      setSnippet(w.snippet);
      if (w.config) {
        if (w.config.title) setTitle(w.config.title);
        if (w.config.greeting) setGreeting(w.config.greeting);
        if (w.config.color) setColor(w.config.color);
      }
    }).catch(() => setMsg({ ok: false, text: 'טעינת ההגדרות נכשלה' })).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.tenant.widget.update({ enabled, config: { title, greeting, color } });
      const w = await api.tenant.widget.get(); // refresh to get a freshly-minted snippet
      setSnippet(w.snippet);
      setMsg({ ok: true, text: 'ההגדרות נשמרו ✓' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'השמירה נכשלה' });
    } finally {
      setSaving(false);
    }
  };

  const copySnippet = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">טוען…</div>;
  if (!available) {
    return (
      <div className="p-8 flex flex-col items-center text-center gap-2 text-slate-500">
        <KeyRound className="w-9 h-9 text-slate-300" />
        <p className="text-sm font-semibold">צ׳אט לאתר — שדרוג בתשלום</p>
        <p className="text-xs">ווידג׳ט הצ׳אט כלול במסלול BASIC ומעלה.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <section className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">ווידג׳ט צ׳אט באתר</h3>
          <p className="text-xs text-slate-500 mt-0.5">מבקרים באתר שלך יכתבו — והשיחה תיכנס לכאן כליד.</p>
        </div>
        <ToggleBtn on={enabled} onClick={() => setEnabled((v) => !v)} />
      </section>

      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">כותרת</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">הודעת פתיחה</label>
          <textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-400">צבע</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="w-9 h-8 rounded border border-surface-border bg-white cursor-pointer" />
          <span className="text-xs font-mono text-slate-500" dir="ltr">{color}</span>
        </div>
      </div>

      {msg && <p className={cn('text-xs font-medium', msg.ok ? 'text-green-600' : 'text-red-500')}>{msg.text}</p>}
      <button onClick={save} disabled={saving}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition">
        {saving ? 'שומר…' : 'שמור הגדרות'}
      </button>

      {enabled && snippet && (
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] text-slate-400">הדבק קוד זה באתר שלך (לפני &lt;/body&gt;):</label>
          <div className="relative">
            <textarea readOnly value={snippet} rows={2} dir="ltr"
              className="w-full px-3 py-2 text-[11px] font-mono rounded-lg border border-surface-border bg-slate-50 resize-none" />
            <button onClick={copySnippet}
              className="absolute top-2 left-2 flex items-center gap-1 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded px-2 py-1">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'הועתק' : 'העתק'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Engagement: round-robin + auto-replies ──────────────────────────────────
const WEEK_DAYS = [
  { i: 0, label: 'א' }, { i: 1, label: 'ב' }, { i: 2, label: 'ג' }, { i: 3, label: 'ד' },
  { i: 4, label: 'ה' }, { i: 5, label: 'ו' }, { i: 6, label: 'ש' },
];

const DEFAULT_AUTO: AutoRepliesConfig = {
  greeting: { enabled: false, text: 'שלום! קיבלנו את פנייתך ונחזור אליך בהקדם 🙏' },
  offHours: { enabled: false, text: 'תודה על פנייתך! אנחנו זמינים א׳-ה׳ 09:00-18:00 ונחזור אליך בשעות הפעילות.', days: [0, 1, 2, 3, 4], from: '09:00', to: '18:00', tz: 'Asia/Jerusalem' },
  away: { enabled: false, text: 'מיד נחזור אליך 🙌', delayMin: 5 },
  csat: { enabled: false, askText: 'תודה שבחרת בנו! נשמח אם תדרג/י את השירות שקיבלת מ-1 (לא מרוצה) עד 5 (מרוצה מאוד) 🙏', delayMin: 60 },
};

function EngagementSettings() {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [roundRobin, setRoundRobin] = useState(false);
  const [slaTarget, setSlaTarget] = useState(30);
  const [attrDefs, setAttrDefs] = useState<AttributeDef[]>([]);
  const [cfg, setCfg] = useState<AutoRepliesConfig>(DEFAULT_AUTO);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([api.tenant.settings(), api.tenant.entitlements()])
      .then(([s, e]) => {
        setRoundRobin(s.assignmentMode === 'round_robin');
        setSlaTarget(s.slaTargetMinutes ?? 30);
        setAttrDefs(s.attributeDefs ?? []);
        // Merge stored config over defaults so newly-added sub-fields always exist.
        const stored = s.autoReplies ?? {};
        setCfg({
          greeting: { ...DEFAULT_AUTO.greeting!, ...stored.greeting },
          offHours: { ...DEFAULT_AUTO.offHours!, ...stored.offHours },
          away: { ...DEFAULT_AUTO.away!, ...stored.away },
          csat: { ...DEFAULT_AUTO.csat!, ...stored.csat },
        });
        setLocked(!e.entitlements.features.autoReplies);
      })
      .catch(() => setMsg({ ok: false, text: 'טעינת ההגדרות נכשלה' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.tenant.updateEngagement({
        assignmentMode: roundRobin ? 'round_robin' : 'manual',
        autoReplies: cfg,
        slaTargetMinutes: slaTarget,
        attributeDefs: attrDefs.filter((d) => d.key.trim() && d.label.trim()),
      });
      setMsg({ ok: true, text: 'ההגדרות נשמרו ✓' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'השמירה נכשלה' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">טוען…</div>;

  if (locked) {
    return (
      <div className="p-8 flex flex-col items-center text-center gap-2 text-slate-500">
        <KeyRound className="w-9 h-9 text-slate-300" />
        <p className="text-sm font-semibold">אוטומציה — שדרוג בתשלום</p>
        <p className="text-xs">מענה אוטומטי וניתוב לנציגים כלולים במסלול BASIC ומעלה.</p>
      </div>
    );
  }

  const patch = (k: keyof AutoRepliesConfig, v: object) => setCfg((c) => ({ ...c, [k]: { ...c[k], ...v } }));

  return (
    <div className="p-5 space-y-5">
      {/* Round-robin */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">ניתוב אוטומטי לנציגים</h3>
            <p className="text-xs text-slate-500 mt-0.5">שיחות חדשות יחולקו בסבב בין הנציגים הפעילים.</p>
          </div>
          <ToggleBtn on={roundRobin} onClick={() => setRoundRobin((v) => !v)} />
        </div>
      </section>

      <div className="h-px bg-surface-border" />

      {/* SLA target */}
      <section className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">יעד זמן מענה (SLA)</h3>
          <p className="text-xs text-slate-500 mt-0.5">לחישוב אחוז העמידה ביעד בדשבורד.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <input type="number" min={1} max={1440} value={slaTarget}
            onChange={(e) => setSlaTarget(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 px-2 py-1 rounded-lg border border-surface-border bg-surface-muted" dir="ltr" />
          <span>דקות</span>
        </div>
      </section>

      <div className="h-px bg-surface-border" />

      {/* Greeting */}
      <AutoBlock
        title="הודעת פתיחה" hint="נשלחת אוטומטית בפנייה ראשונה של לקוח חדש."
        on={!!cfg.greeting?.enabled} onToggle={() => patch('greeting', { enabled: !cfg.greeting?.enabled })}
        text={cfg.greeting?.text ?? ''} onText={(t) => patch('greeting', { text: t })}
      />

      {/* Off-hours */}
      <AutoBlock
        title="מחוץ לשעות פעילות" hint="נשלחת כשמגיעה הודעה מחוץ לימים/שעות שהוגדרו."
        on={!!cfg.offHours?.enabled} onToggle={() => patch('offHours', { enabled: !cfg.offHours?.enabled })}
        text={cfg.offHours?.text ?? ''} onText={(t) => patch('offHours', { text: t })}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {WEEK_DAYS.map((d) => {
            const active = cfg.offHours?.days?.includes(d.i);
            return (
              <button key={d.i} type="button"
                onClick={() => {
                  const days = new Set(cfg.offHours?.days ?? []);
                  active ? days.delete(d.i) : days.add(d.i);
                  patch('offHours', { days: [...days].sort() });
                }}
                className={cn('w-7 h-7 rounded-lg text-xs font-semibold transition',
                  active ? 'bg-brand-600 text-white' : 'bg-surface-subtle text-slate-500 hover:bg-slate-200')}>
                {d.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>משעה</span>
          <input type="time" value={cfg.offHours?.from ?? '09:00'} onChange={(e) => patch('offHours', { from: e.target.value })}
            className="px-2 py-1 rounded-lg border border-surface-border bg-surface-muted" dir="ltr" />
          <span>עד</span>
          <input type="time" value={cfg.offHours?.to ?? '18:00'} onChange={(e) => patch('offHours', { to: e.target.value })}
            className="px-2 py-1 rounded-lg border border-surface-border bg-surface-muted" dir="ltr" />
        </div>
      </AutoBlock>

      {/* Away */}
      <AutoBlock
        title="הודעת המתנה" hint="נשלחת אם אף נציג לא הגיב תוך מספר הדקות שהוגדר."
        on={!!cfg.away?.enabled} onToggle={() => patch('away', { enabled: !cfg.away?.enabled })}
        text={cfg.away?.text ?? ''} onText={(t) => patch('away', { text: t })}
      >
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>השהיה:</span>
          <input type="number" min={1} max={180} value={cfg.away?.delayMin ?? 5}
            onChange={(e) => patch('away', { delayMin: Math.max(1, Number(e.target.value) || 1) })}
            className="w-16 px-2 py-1 rounded-lg border border-surface-border bg-surface-muted" dir="ltr" />
          <span>דקות</span>
        </div>
      </AutoBlock>

      {/* CSAT survey */}
      <AutoBlock
        title="סקר שביעות רצון" hint="נשלח אוטומטית אחרי סגירת ליד; תשובה 1-5 נרשמת בדשבורד."
        on={!!cfg.csat?.enabled} onToggle={() => patch('csat', { enabled: !cfg.csat?.enabled })}
        text={cfg.csat?.askText ?? ''} onText={(t) => patch('csat', { askText: t })}
      >
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>לשלוח</span>
          <input type="number" min={1} max={10080} value={cfg.csat?.delayMin ?? 60}
            onChange={(e) => patch('csat', { delayMin: Math.max(1, Number(e.target.value) || 1) })}
            className="w-20 px-2 py-1 rounded-lg border border-surface-border bg-surface-muted" dir="ltr" />
          <span>דקות אחרי הסגירה</span>
        </div>
      </AutoBlock>

      <div className="h-px bg-surface-border" />

      {/* Custom attribute definitions */}
      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">שדות מותאמים</h3>
          <p className="text-xs text-slate-500 mt-0.5">שדות נוספים שיופיעו בכרטיס הליד (למשל: תקציב, עיר, מקור).</p>
        </div>
        <div className="space-y-3">
          {attrDefs.map((def, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input value={def.label} placeholder="שם השדה"
                  onChange={(e) => setAttrDefs((d) => d.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-surface-border bg-surface-muted" />
                <input value={def.key} placeholder="key" dir="ltr"
                  onChange={(e) => setAttrDefs((d) => d.map((x, j) => j === i ? { ...x, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') } : x))}
                  className="w-24 px-2 py-1.5 text-xs font-mono rounded-lg border border-surface-border bg-surface-muted" />
                <select value={def.type}
                  onChange={(e) => setAttrDefs((d) => d.map((x, j) => j === i ? { ...x, type: e.target.value as AttributeDef['type'] } : x))}
                  className="px-1 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-muted">
                  <option value="text">טקסט</option>
                  <option value="number">מספר</option>
                  <option value="select">בחירה</option>
                </select>
                <button type="button" onClick={() => setAttrDefs((d) => d.filter((_, j) => j !== i))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {def.type === 'select' && (
                <input value={(def.options ?? []).join(', ')} placeholder="אפשרויות מופרדות בפסיק (למשל: תל אביב, חיפה)"
                  onChange={(e) => setAttrDefs((d) => d.map((x, j) => j === i ? { ...x, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-muted" />
              )}
            </div>
          ))}
          <button type="button" onClick={() => setAttrDefs((d) => [...d, { key: '', label: '', type: 'text' }])}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> הוסף שדה
          </button>
        </div>
      </section>

      {msg && (
        <p className={cn('text-xs font-medium', msg.ok ? 'text-green-600' : 'text-red-500')}>{msg.text}</p>
      )}
      <button onClick={save} disabled={saving}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition">
        {saving ? 'שומר…' : 'שמור הגדרות'}
      </button>
    </div>
  );
}

function ToggleBtn({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex-shrink-0" aria-pressed={on}>
      {on ? <ToggleRight className="w-9 h-9 text-brand-600" /> : <ToggleLeft className="w-9 h-9 text-slate-300" />}
    </button>
  );
}

function AutoBlock({ title, hint, on, onToggle, text, onText, children }: {
  title: string; hint: string; on: boolean; onToggle: () => void;
  text: string; onText: (t: string) => void; children?: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        </div>
        <ToggleBtn on={on} onClick={onToggle} />
      </div>
      {on && (
        <div className="space-y-2 pr-1">
          <textarea value={text} onChange={(e) => onText(e.target.value)} rows={2}
            placeholder="תוכן ההודעה…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition resize-none" />
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Templates Manager ────────────────────────────────────────────────────────
function TemplatesManager() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('כללי');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.templates.list().then(setItems).catch(() => setError('טעינת התבניות נכשלה')).finally(() => setLoading(false));
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const t = await api.templates.create({ title: title.trim(), body: body.trim(), category: category.trim() || 'כללי' });
      setItems((prev) => [...prev, t]);
      setTitle(''); setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת התבנית נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    await api.templates.delete(id).catch(() => {});
  };

  return (
    <div className="p-5 space-y-4">
      <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
        תבניות תשובה מהירה לצ׳אט. אפשר להשתמש במשתנים: <code className="bg-blue-100 px-1 rounded" dir="ltr">{'{{שם}}'}</code> · <code className="bg-blue-100 px-1 rounded" dir="ltr">{'{{טלפון}}'}</code>
      </div>

      <form onSubmit={add} className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת" className={inputCls + ' col-span-2'} />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="קטגוריה" className={inputCls} />
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="תוכן ההודעה…" rows={3}
          className={inputCls + ' resize-none leading-relaxed'} />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={!title.trim() || !body.trim() || saving}
          className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> {saving ? 'מוסיף…' : 'הוסף תבנית'}
        </button>
      </form>

      {loading ? (
        <p className="text-center text-slate-400 text-sm py-4">טוען…</p>
      ) : items.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-4">אין תבניות עדיין — הוסף את הראשונה למעלה.</p>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div key={t.id} className="border border-surface-border rounded-lg p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">{t.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">{t.category}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.body}</p>
              </div>
              <button onClick={() => remove(t.id)} title="מחק" className="text-slate-300 hover:text-red-500 transition flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
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
      // Read the current user from the JWT via the shared helper. The previous inline
      // atob() didn't convert base64url (- _) to base64, so any token whose payload
      // contained those chars failed to parse and the name rendered blank.
      const t = decodeToken();
      setUsername(t?.username ?? '');
      setRole(t?.role ?? '');
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

  const roleLabels: Record<string, string> = { SUPER_ADMIN: 'מנהל-על', ADMIN: 'אדמין', MANAGER: 'מנהל', AGENT: 'נציג' };
  // Editing company name/email is an admin-only action; managers/agents only view it.
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(decodeToken()?.role ?? '');

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

      {isAdmin ? (
        <>
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
        </>
      ) : (
        <div className="text-xs text-slate-500 bg-surface-muted rounded-lg px-3 py-2">
          <span className="font-semibold">{tenantName}</span> · {tenantEmail}
        </div>
      )}

      <GoogleLoginLink />
    </div>
  );
}

// ─── Google Sign-In linking ───────────────────────────────────────────────────
function GoogleLoginLink() {
  const [state, setState] = useState<{ configured: boolean; linked: boolean; email: string | null } | null>(null);

  const load = () => authFetch('/api/auth/google/status').then(({ data }) => setState(data as never)).catch(() => {});
  useEffect(() => {
    load();
    // Reflect a just-completed linking (the OAuth flow redirects to /?googleLinked=1).
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('googleLinked')) load();
  }, []);

  const link = async () => {
    const { ok, data } = await authFetch('/api/auth/google/link');
    if (ok && (data as { url?: string }).url) window.location.href = (data as { url: string }).url;
  };
  const unlink = async () => {
    await authFetch('/api/auth/google/unlink', {}, 'POST');
    load();
  };

  if (!state) return null;
  return (
    <div className="border-t border-surface-border pt-4 space-y-2">
      <label className="text-xs font-semibold text-slate-600">התחברות עם Google</label>
      {!state.configured ? (
        <p className="text-xs text-slate-400">התחברות Google אינה מוגדרת בשרת (נדרש GOOGLE_CLIENT_ID).</p>
      ) : state.linked ? (
        <div className="flex items-center justify-between gap-2 bg-green-50 rounded-lg px-3 py-2">
          <span className="text-xs text-green-700 truncate">מקושר{state.email ? ` · ${state.email}` : ''}</span>
          <button onClick={unlink} className="text-xs font-semibold text-red-500 hover:text-red-600 flex-shrink-0">נתק</button>
        </div>
      ) : (
        <button onClick={link} className="w-full py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700 transition">
          קשר חשבון Google לכניסה מהירה
        </button>
      )}
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
  const { confirm, dialog: confirmDialog } = useConfirm();
  // Only true admins can create/edit MANAGER/ADMIN users; a MANAGER may manage AGENTs only.
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(decodeToken()?.role ?? '');

  const roleLabels: Record<string, string> = { SUPER_ADMIN: 'מנהל-על', ADMIN: 'אדמין', MANAGER: 'מנהל', AGENT: 'נציג' };

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

  const handleDeleteUser = async (id: string, username: string) => {
    if (!(await confirm(`להסיר את ${username} מהמערכת? פעולה זו בלתי הפיכה.`))) return;
    try {
      await api.tenant.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'הסרת המשתמש נכשלה');
    }
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
            {isAdmin && user.role !== 'SUPER_ADMIN' ? (
              <select
                value={user.role}
                onChange={(e) => handleChangeRole(user.id, e.target.value)}
                className="text-[11px] border border-surface-border rounded-lg px-2 py-1 bg-surface-muted focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="AGENT">נציג</option>
                <option value="MANAGER">מנהל</option>
                <option value="ADMIN">אדמין</option>
              </select>
            ) : (
              <span className="text-[11px] text-slate-400 px-1">{roleLabels[user.role] ?? user.role}</span>
            )}
            <button onClick={() => handleToggleActive(user.id, user.active)}
              title={user.active ? 'נעילת משתמש' : 'שחרור משתמש'}
              className={cn('transition', user.active ? 'text-green-500 hover:text-red-500' : 'text-slate-300 hover:text-green-500')}>
              {user.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
            <button onClick={() => handleDeleteUser(user.id, user.username)}
              title="הסרת משתמש"
              className="text-slate-300 hover:text-red-500 transition">
              <Trash2 className="w-4 h-4" />
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
          {isAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">תפקיד</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                className={inputCls}>
                <option value="AGENT">נציג</option>
                <option value="MANAGER">מנהל</option>
                <option value="ADMIN">אדמין</option>
              </select>
            </div>
          )}
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
      {confirmDialog}
    </div>
  );
}

// ─── Green API Settings ───────────────────────────────────────────────────────
function GreenApiSettings() {
  const [instanceId, setInstanceId] = useState('');
  const [token, setToken] = useState('');
  const [tokenSet, setTokenSet] = useState(false); // a token exists server-side (never sent to us)
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
      setTokenSet(Boolean(s.greenApiTokenSet)); // token is write-only; never returned
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const webhookUrl = instanceId
    ? `${API_URL}/api/webhook/${instanceId}`
    : '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Token is write-only: an existing (tokenSet) one may be kept without re-typing.
    if (!instanceId.trim() || (!token.trim() && !tokenSet)) { setError('נדרשים Instance ID ו-Token'); return; }
    setSaving(true); setError(''); setSuccess(false);
    try {
      await api.tenant.updateGreenApi({ greenApiInstanceId: instanceId.trim(), greenApiToken: token.trim(), greenApiWebhookUrl: webhookUrl });
      setTokenSet(true); setToken('');
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
            placeholder={tokenSet ? '•••••••• (שמור כדי לשנות)' : 'a14b720...'} dir="ltr" autoComplete="off"
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
          <div dir="ltr" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-600 break-all select-all">
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
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition',
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'bg-white text-slate-500 border border-surface-border hover:text-slate-700 hover:border-brand-200',
      )}
    >
      {icon}{label}
    </button>
  );
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition font-mono';

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, Send, Pause, Play, Trash2, Users, X, Clock, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, ALL_STATUSES, STATUS_CONFIG } from '@/lib/utils';
import type { Campaign, CampaignFilter, Project, LeadStatus } from '@/types';
import { useConfirm } from './useConfirm';

const STATUS_LABEL: Record<Campaign['status'], { label: string; cls: string }> = {
  draft: { label: 'טיוטה', cls: 'bg-slate-100 text-slate-600' },
  scheduled: { label: 'מתוזמן', cls: 'bg-amber-50 text-amber-600' },
  running: { label: 'פעיל', cls: 'bg-blue-50 text-blue-600' },
  paused: { label: 'מושהה', cls: 'bg-orange-50 text-orange-600' },
  done: { label: 'הסתיים', cls: 'bg-green-50 text-green-600' },
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const load = useCallback(async () => {
    try { setCampaigns(await api.campaigns.list()); } catch { /* 401 handled globally */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Live-ish progress: refresh while any campaign is running.
  useEffect(() => {
    if (!campaigns.some((c) => c.status === 'running' || c.status === 'scheduled')) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [campaigns, load]);

  const remove = async (c: Campaign) => {
    if (!(await confirm(`למחוק את הקמפיין "${c.name}"?`))) return;
    setCampaigns((p) => p.filter((x) => x.id !== c.id));
    await api.campaigns.remove(c.id).catch(() => load());
  };
  const pause = async (c: Campaign) => { await api.campaigns.pause(c.id).catch(() => {}); load(); };
  const resume = async (c: Campaign) => { await api.campaigns.resume(c.id).catch(() => {}); load(); };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-muted">
      <div className="px-6 py-4 bg-white border-b border-surface-border flex items-center justify-between">
        <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-brand-600" /> קמפיינים
        </h2>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition">
          <Plus className="w-4 h-4" /> קמפיין חדש
        </button>
      </div>

      <div className="p-6 space-y-3 max-w-3xl mx-auto">
        {loading ? (
          <p className="text-center text-sm text-slate-400 py-10">טוען…</p>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-slate-400 py-16">
            <Megaphone className="w-10 h-10 text-slate-300" />
            <p className="text-sm">אין קמפיינים עדיין</p>
            <button onClick={() => setEditing('new')} className="text-sm font-semibold text-brand-600 hover:underline">צור קמפיין ראשון</button>
          </div>
        ) : (
          campaigns.map((c) => {
            const st = STATUS_LABEL[c.status];
            const done = c.stats.sent + c.stats.delivered + c.stats.read + c.stats.failed + c.stats.skipped;
            const pct = c.stats.total > 0 ? Math.round((done / c.stats.total) * 100) : 0;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-surface-border p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setEditing(c)} className="text-right flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 text-sm truncate">{c.name}</span>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', st.cls)}>{st.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{c.body || 'ללא תוכן'}</p>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {c.status === 'running' && <button onClick={() => pause(c)} title="השהה" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-surface-subtle"><Pause className="w-4 h-4" /></button>}
                    {c.status === 'paused' && <button onClick={() => resume(c)} title="המשך" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-surface-subtle"><Play className="w-4 h-4" /></button>}
                    <button onClick={() => remove(c)} title="מחק" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {c.stats.total > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>{done}/{c.stats.total} נשלחו</span>
                      <span className="flex items-center gap-2">
                        <span className="text-green-600">✓ {c.stats.delivered + c.stats.read}</span>
                        {c.stats.read > 0 && <span className="text-brand-600">נקראו {c.stats.read}</span>}
                        {c.stats.failed > 0 && <span className="text-red-500">נכשלו {c.stats.failed}</span>}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <CampaignEditor
          campaign={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onToast={setToast}
        />
      )}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">{toast}</div>
      )}
      {dialog}
    </div>
  );
}

function CampaignEditor({ campaign, onClose, onSaved, onToast }: {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
  onToast: (t: string) => void;
}) {
  const readOnly = !!campaign && campaign.status !== 'draft';
  const [id, setId] = useState<string | null>(campaign?.id ?? null);
  const [name, setName] = useState(campaign?.name ?? '');
  const [body, setBody] = useState(campaign?.body ?? '');
  const [status, setStatus] = useState(campaign?.filter?.status ?? 'all');
  const [projectId, setProjectId] = useState(campaign?.filter?.projectId ?? '');
  const [tags, setTags] = useState((campaign?.filter?.tags ?? []).join(', '));
  const [scheduledAt, setScheduledAt] = useState(campaign?.scheduledAt ? campaign.scheduledAt.slice(0, 16) : '');
  const [projects, setProjects] = useState<Project[]>([]);
  const [audience, setAudience] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.projects.list().then(setProjects).catch(() => {}); }, []);

  const buildFilter = (): CampaignFilter => ({
    status,
    projectId: projectId || undefined,
    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    channel: 'WHATSAPP',
  });

  // Ensure a saved draft exists (create or update) and return its id.
  const ensureDraft = async (): Promise<string> => {
    const data = { name: name.trim() || 'קמפיין ללא שם', body, filter: buildFilter(), scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null };
    if (id) { await api.campaigns.update(id, data); return id; }
    const c = await api.campaigns.create(data); setId(c.id); return c.id;
  };

  const doPreview = async () => {
    setBusy(true);
    try { const cid = await ensureDraft(); const r = await api.campaigns.preview(cid); setAudience(r.count); }
    catch (e) { onToast(e instanceof Error ? e.message : 'שגיאה'); } finally { setBusy(false); }
  };

  const saveDraft = async () => {
    setBusy(true);
    try { await ensureDraft(); onToast('נשמר כטיוטה ✓'); onSaved(); }
    catch (e) { onToast(e instanceof Error ? e.message : 'שמירה נכשלה'); } finally { setBusy(false); }
  };

  const doSend = async () => {
    if (!body.trim()) { onToast('כתוב תוכן להודעה'); return; }
    setBusy(true);
    try {
      const cid = await ensureDraft();
      const r = await api.campaigns.send(cid);
      onToast(scheduledAt ? `הקמפיין תוזמן (${r.audience} נמענים)` : `הקמפיין יצא לדרך — ${r.audience} נמענים`);
      onSaved();
    } catch (e) { onToast(e instanceof Error ? e.message : 'השליחה נכשלה'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border sticky top-0 bg-white">
          <h2 className="font-bold text-slate-800 text-base">{readOnly ? 'תוצאות קמפיין' : campaign ? 'עריכת קמפיין' : 'קמפיין חדש'}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        {readOnly && campaign ? (
          <CampaignResults campaign={campaign} />
        ) : (
          <div className="p-5 space-y-4">
            <Field label="שם הקמפיין">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: מבצע סוף עונה"
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </Field>

            <div className="bg-surface-subtle rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> קהל היעד</p>
              <div className="grid grid-cols-2 gap-2">
                <select value={status} onChange={(e) => { setStatus(e.target.value); setAudience(null); }}
                  className="px-2 py-1.5 text-sm rounded-lg border border-surface-border bg-white">
                  <option value="all">כל הסטטוסים</option>
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s as LeadStatus].label}</option>)}
                </select>
                <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setAudience(null); }}
                  className="px-2 py-1.5 text-sm rounded-lg border border-surface-border bg-white">
                  <option value="">כל הפרויקטים</option>
                  {projects.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <input value={tags} onChange={(e) => { setTags(e.target.value); setAudience(null); }} placeholder="תגיות (מופרדות בפסיק) — אופציונלי"
                className="w-full px-2 py-1.5 text-sm rounded-lg border border-surface-border bg-white" />
              <div className="flex items-center justify-between">
                <button onClick={doPreview} disabled={busy} className="text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50">בדוק כמה נמענים</button>
                {audience !== null && <span className="text-xs font-bold text-slate-700">{audience} נמענים</span>}
              </div>
              <p className="text-[11px] text-slate-400">שולח רק ללקוחות וואטסאפ שלא הוסרו מרשימת התפוצה.</p>
            </div>

            <Field label="תוכן ההודעה">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="שלום {{שם}}, ..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              <p className="text-[11px] text-slate-400 mt-1">משתנים: <code dir="ltr" className="bg-slate-100 px-1 rounded">{'{{שם}}'}</code> <code dir="ltr" className="bg-slate-100 px-1 rounded">{'{{attr:key}}'}</code></p>
            </Field>

            <Field label="תזמון (אופציונלי)">
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </Field>

            <div className="flex gap-2 pt-1">
              <button onClick={saveDraft} disabled={busy} className="flex-1 border border-surface-border text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-surface-subtle disabled:opacity-50">שמור טיוטה</button>
              <button onClick={doSend} disabled={busy} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Send className="w-4 h-4" /> {scheduledAt ? 'תזמן שליחה' : 'שלח עכשיו'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignResults({ campaign }: { campaign: Campaign }) {
  const s = campaign.stats;
  const rows: Array<{ label: string; val: number; icon: React.ReactNode; cls: string }> = [
    { label: 'נשלחו', val: s.sent + s.delivered + s.read, icon: <Check className="w-4 h-4" />, cls: 'text-slate-600' },
    { label: 'נמסרו', val: s.delivered + s.read, icon: <Check className="w-4 h-4" />, cls: 'text-green-600' },
    { label: 'נקראו', val: s.read, icon: <Check className="w-4 h-4" />, cls: 'text-brand-600' },
    { label: 'ממתינים', val: s.pending, icon: <Clock className="w-4 h-4" />, cls: 'text-amber-600' },
    { label: 'נכשלו', val: s.failed, icon: <AlertCircle className="w-4 h-4" />, cls: 'text-red-500' },
    { label: 'דולגו', val: s.skipped, icon: <X className="w-4 h-4" />, cls: 'text-slate-400' },
  ];
  return (
    <div className="p-5 space-y-4">
      <div className="bg-surface-subtle rounded-xl p-3">
        <p className="text-xs text-slate-500 mb-1">תוכן</p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{campaign.body}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="bg-white border border-surface-border rounded-xl p-3 text-center">
            <div className={cn('flex items-center justify-center gap-1', r.cls)}>{r.icon}<span className="text-lg font-bold">{r.val}</span></div>
            <p className="text-[11px] text-slate-500 mt-0.5">{r.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 text-center">סה״כ {s.total} נמענים</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

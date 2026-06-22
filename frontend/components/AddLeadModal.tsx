'use client';

import { useState, useRef } from 'react';
import { X, UserPlus, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import type { Lead } from '@/types';
import { cn, ALL_STATUSES, ALL_PRIORITIES, STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/utils';

interface AddLeadModalProps {
  onClose: () => void;
  onLeadAdded: (lead: Lead) => void;
  onLeadsImported: (count: number) => void;
}

type Tab = 'manual' | 'import';

export function AddLeadModal({ onClose, onLeadAdded, onLeadsImported }: AddLeadModalProps) {
  const [tab, setTab] = useState<Tab>('manual');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="font-bold text-slate-800 text-base">הוספת ליד</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-border">
          <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')} icon={<UserPlus className="w-3.5 h-3.5" />} label="הוספה ידנית" />
          <TabBtn active={tab === 'import'} onClick={() => setTab('import')} icon={<Upload className="w-3.5 h-3.5" />} label="ייבוא CSV / Excel" />
        </div>

        {tab === 'manual' ? (
          <ManualForm onClose={onClose} onLeadAdded={onLeadAdded} />
        ) : (
          <ImportForm onClose={onClose} onLeadsImported={onLeadsImported} />
        )}
      </div>
    </div>
  );
}

// ─── Manual Form ──────────────────────────────────────────────────────────────
function ManualForm({ onClose, onLeadAdded }: { onClose: () => void; onLeadAdded: (lead: Lead) => void }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', company: '', status: 'NEW', priority: 'Med', assignedTo: '', internalNotes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('שם וטלפון הם שדות חובה');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const lead = await api.leads.create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        company: form.company.trim() || undefined,
        status: form.status,
        priority: form.priority,
        assignedTo: form.assignedTo || undefined,
        internalNotes: form.internalNotes || undefined,
      });
      onLeadAdded(lead);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="שם מלא *">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="ישראל ישראלי" className={inputCls} />
        </Field>
        <Field label="טלפון *">
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="050-1234567" dir="ltr" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="אימייל">
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@example.com" dir="ltr" className={inputCls} />
        </Field>
        <Field label="חברה">
          <input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="שם החברה" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="סטטוס">
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        </Field>
        <Field label="עדיפות">
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={inputCls}>
            {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="מוקצה לנציג">
        <input value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)} placeholder="שם הנציג" className={inputCls} />
      </Field>

      <Field label="הערות פנימיות">
        <textarea value={form.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} placeholder="הערות..." rows={2} className={cn(inputCls, 'resize-none')} />
      </Field>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-slate-600 hover:bg-surface-subtle transition">
          ביטול
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50">
          {saving ? 'שומר...' : 'הוסף ליד'}
        </button>
      </div>
    </form>
  );
}

// ─── Import Form ──────────────────────────────────────────────────────────────
function ImportForm({ onClose, onLeadsImported }: { onClose: () => void; onLeadsImported: (count: number) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError('אנא בחר קובץ CSV או Excel');
      return;
    }
    setFile(f);
    setError('');
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        setError('הקובץ ריק או בפורמט שגוי');
        setLoading(false);
        return;
      }

      const res = await api.leads.import(rows);
      setResult(res);
      onLeadsImported(res.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בייבוא');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="p-5 space-y-4">
        <div className="bg-green-50 rounded-xl p-4 text-center space-y-1">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
          <p className="font-bold text-green-700 text-lg">{result.created} לידים יובאו בהצלחה</p>
          {result.skipped > 0 && <p className="text-sm text-slate-500">{result.skipped} דולגו (כבר קיימים)</p>}
        </div>
        <button onClick={onClose} className="w-full py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition">
          סגור
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Template download hint */}
      <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
        <p className="font-semibold mb-1">פורמט הקובץ הנדרש:</p>
        <p>עמודות: <code className="bg-blue-100 px-1 rounded">name, phone, status, priority, assignedTo, tags</code></p>
        <p className="mt-1">רק <strong>name</strong> ו-<strong>phone</strong> הם חובה. תגיות מופרדות בפסיק.</p>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition',
          file ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-surface-subtle'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <Upload className={cn('w-8 h-8 mx-auto mb-2', file ? 'text-brand-500' : 'text-slate-300')} />
        {file ? (
          <p className="text-sm font-semibold text-brand-700">{file.name}</p>
        ) : (
          <>
            <p className="text-sm text-slate-500 font-medium">גרור קובץ לכאן או לחץ לבחירה</p>
            <p className="text-xs text-slate-400 mt-1">CSV, XLS, XLSX</p>
          </>
        )}
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-slate-600 hover:bg-surface-subtle transition">
          ביטול
        </button>
        <button onClick={handleImport} disabled={!file || loading} className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-50">
          {loading ? 'מייבא...' : 'ייבא לידים'}
        </button>
      </div>
    </div>
  );
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────
// Splits a single CSV line, honoring double-quoted fields (which may contain commas
// and escaped "" quotes). A naive split(',') corrupts every column after a quoted comma.
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCSV(text: string) {
  const lines = text.replace(/\r/g, '').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return {
      name: row['name'] || row['שם'] || '',
      phone: row['phone'] || row['טלפון'] || '',
      status: row['status'] || row['סטטוס'] || '',
      priority: row['priority'] || row['עדיפות'] || '',
      assignedTo: row['assignedto'] || row['נציג'] || '',
      tags: row['tags'] || row['תגיות'] || '',
    };
  }).filter((r) => r.name && r.phone);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
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

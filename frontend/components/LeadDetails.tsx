'use client';

import { useState, useEffect } from 'react';
import {
  User, Phone, Calendar, StickyNote, TrendingUp, UserCheck, Save, Tag, History, FolderKanban, Mail, Building2, Clock, Trash2,
} from 'lucide-react';
import { cn, STATUS_CONFIG, PRIORITY_CONFIG, ALL_PRIORITIES, formatTime, toDatetimeLocal, fromDatetimeLocal } from '@/lib/utils';
import type { Lead, Priority, LeadStatus, Project } from '@/types';
import { TagsInput } from './TagsInput';
import { ActivityLog } from './ActivityLog';
import { api } from '@/lib/api';

interface LeadDetailsProps {
  lead: Lead;
  onUpdate: (data: Partial<Lead>) => Promise<void>;
  onDelete?: () => Promise<void> | void;
}

type Tab = 'info' | 'activity';

export function LeadDetails({ lead, onUpdate, onDelete }: LeadDetailsProps) {
  const [tab, setTab] = useState<Tab>('info');
  const [name, setName] = useState(lead.name ?? '');
  const [email, setEmail] = useState(lead.email ?? '');
  const [company, setCompany] = useState(lead.company ?? '');
  const [notes, setNotes] = useState(lead.internalNotes ?? '');
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? '');
  const [tags, setTags] = useState<string[]>(lead.tags ?? []);
  const [meetingDate, setMeetingDate] = useState(toDatetimeLocal(lead.meetingDate));
  const [meetingNotes, setMeetingNotes] = useState(lead.meetingNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tenantUsers, setTenantUsers] = useState<Array<{ id: string; username: string; role: string; active: boolean }>>([]);

  useEffect(() => {
    setName(lead.name ?? '');
    setEmail(lead.email ?? '');
    setCompany(lead.company ?? '');
    setNotes(lead.internalNotes ?? '');
    setAssignedTo(lead.assignedTo ?? '');
    setTags(lead.tags ?? []);
    setMeetingDate(toDatetimeLocal(lead.meetingDate));
    setMeetingNotes(lead.meetingNotes ?? '');
    setDirty(false);
    setConfirmDelete(false);
  }, [lead.id, lead.name, lead.email, lead.company, lead.internalNotes, lead.assignedTo, lead.tags, lead.meetingDate, lead.meetingNotes]);

  // Load projects and users for dropdowns
  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => {});
    api.tenant.listUsers().then(setTenantUsers).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        name,
        email: email || null,
        company: company || null,
        internalNotes: notes,
        assignedTo: assignedTo || null,
        tags,
        meetingDate: fromDatetimeLocal(meetingDate),
        meetingNotes: meetingNotes || null,
      } as Partial<Lead>);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const statusCfg = STATUS_CONFIG[lead.status as LeadStatus];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-surface-border flex-shrink-0">
        <TabBtn active={tab === 'info'} onClick={() => setTab('info')} icon={<User className="w-3.5 h-3.5" />} label="פרטים" />
        <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')} icon={<History className="w-3.5 h-3.5" />} label="היסטוריה" />
      </div>

      {tab === 'info' ? (
        <div className="flex-1 overflow-y-auto">
          {/* Personal Details */}
          <div className="px-4 py-4 border-b border-surface-border">
            <SectionHeader icon={<User className="w-3.5 h-3.5" />} label="פרטים אישיים" />
            <div className="mt-2 space-y-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> שם</label>
                <input type="text" value={name}
                  onChange={(e) => { setName(e.target.value); setDirty(true); }}
                  placeholder="שם מלא..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> אימייל</label>
                <input type="email" value={email} dir="ltr"
                  onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-1"><Building2 className="w-3 h-3" /> חברה</label>
                <input type="text" value={company}
                  onChange={(e) => { setCompany(e.target.value); setDirty(true); }}
                  placeholder="שם החברה..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
              </div>
              <div className="bg-surface-subtle rounded-xl p-3 space-y-2.5 mt-2">
                <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="טלפון">
                  <span className="font-mono text-slate-700 text-xs" dir="ltr">+{lead.phone}</span>
                </InfoRow>
                <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="הודעה אחרונה">
                  <span className="text-slate-600">{formatTime(lead.lastMessageAt)}</span>
                </InfoRow>
                <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="נוצר">
                  <span className="text-slate-600">{new Date(lead.createdAt).toLocaleDateString('he-IL')}</span>
                </InfoRow>
              </div>
            </div>
          </div>

          {/* Project */}
          <div className="px-4 py-3 border-b border-surface-border">
            <SectionHeader icon={<FolderKanban className="w-3.5 h-3.5" />} label="פרויקט" />
            <select
              value={lead.projectId ?? ''}
              onChange={(e) => onUpdate({ projectId: e.target.value || null } as Partial<Lead>)}
              className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            >
              <option value="">ללא פרויקט</option>
              {projects.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {lead.project && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: lead.project.color }} />
                <span className="text-xs text-slate-500">{lead.project.name}</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="px-4 py-3 border-b border-surface-border">
            <SectionHeader icon={<div className={cn('w-2 h-2 rounded-full', statusCfg.dot)} />} label="סטטוס" />
            <span className={cn('status-badge mt-2 inline-flex', statusCfg.color, statusCfg.bg)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
              {statusCfg.label}
            </span>
          </div>

          {/* Priority */}
          <div className="px-4 py-3 border-b border-surface-border">
            <SectionHeader icon={<TrendingUp className="w-3.5 h-3.5" />} label="עדיפות" />
            <div className="flex gap-2 mt-2">
              {ALL_PRIORITIES.map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const isActive = lead.priority === p;
                return (
                  <button key={p} onClick={() => onUpdate({ priority: p })}
                    className={cn('flex-1 py-1.5 rounded-lg text-xs font-semibold border transition',
                      isActive
                        ? cn(cfg.color, 'border-current', p === 'High' ? 'bg-red-50 border-red-300' : p === 'Med' ? 'bg-amber-50 border-amber-300' : 'bg-slate-100 border-slate-300')
                        : 'border-surface-border text-slate-400 hover:bg-surface-subtle'
                    )}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div className="px-4 py-3 border-b border-surface-border">
            <SectionHeader icon={<Tag className="w-3.5 h-3.5" />} label="תגיות" />
            <div className="mt-2">
              <TagsInput tags={tags} onChange={(t) => { setTags(t); setDirty(true); }} />
            </div>
          </div>

          {/* Assigned To */}
          <div className="px-4 py-3 border-b border-surface-border">
            <SectionHeader icon={<UserCheck className="w-3.5 h-3.5" />} label="מוקצה לנציג" />
            <select
              value={assignedTo}
              onChange={(e) => { setAssignedTo(e.target.value); setDirty(true); }}
              className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            >
              <option value="">לא מוקצה</option>
              {tenantUsers.filter(u => u.active).map((u) => (
                <option key={u.id} value={u.username}>{u.username} ({u.role === 'ADMIN' ? 'מנהל' : 'נציג'})</option>
              ))}
            </select>
          </div>

          {/* Meeting Date */}
          <div className="px-4 py-3 border-b border-surface-border">
            <SectionHeader icon={<Clock className="w-3.5 h-3.5" />} label="פגישה" />
            <div className="mt-2 space-y-2">
              <input type="datetime-local" value={meetingDate}
                onChange={(e) => { setMeetingDate(e.target.value); setDirty(true); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition" dir="ltr" />
              <textarea value={meetingNotes}
                onChange={(e) => { setMeetingNotes(e.target.value); setDirty(true); }}
                placeholder="הערות לפגישה..."
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition resize-none" />
            </div>
          </div>

          {/* Internal Notes */}
          <div className="px-4 py-3 flex flex-col">
            <SectionHeader icon={<StickyNote className="w-3.5 h-3.5" />} label="הערות פנימיות" />
            <textarea value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
              placeholder="הוסף הערות פנימיות..."
              className="mt-2 w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition resize-none leading-relaxed min-h-[100px]" />
            <button onClick={handleSave} disabled={!dirty || saving}
              className={cn('mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-semibold transition',
                dirty && !saving ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
              <Save className="w-3.5 h-3.5" />
              {saving ? 'שומר...' : 'שמור שינויים'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ActivityLog activities={lead.activities ?? []} />
        </div>
      )}

      {/* Delete lead */}
      {onDelete && (
        <div className="border-t border-surface-border p-3 flex-shrink-0">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                למחוק את <span className="font-semibold text-slate-700">{lead.name}</span> לצמיתות?
                <br />כל ההודעות וההיסטוריה יימחקו.
              </p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition disabled:opacity-50">
                  {deleting ? 'מוחק...' : 'כן, מחק'}
                </button>
                <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition">
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 transition font-semibold">
              <Trash2 className="w-3.5 h-3.5" />
              מחק ליד
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={cn('flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition',
        active ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600')}>
      {icon}{label}
    </button>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-500">
      {icon}
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0">
        {icon}
        <span className="text-[11px] text-slate-400">{label}</span>
      </div>
      <div className="text-xs truncate">{children}</div>
    </div>
  );
}

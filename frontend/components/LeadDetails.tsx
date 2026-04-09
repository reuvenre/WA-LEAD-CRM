'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Calendar,
  StickyNote,
  TrendingUp,
  UserCheck,
  Save,
} from 'lucide-react';
import { cn, STATUS_CONFIG, PRIORITY_CONFIG, ALL_PRIORITIES, formatTime } from '@/lib/utils';
import type { Lead, Priority, LeadStatus } from '@/types';

interface LeadDetailsProps {
  lead: Lead;
  onUpdate: (data: Partial<Lead>) => Promise<void>;
}

export function LeadDetails({ lead, onUpdate }: LeadDetailsProps) {
  const [notes, setNotes] = useState(lead.internalNotes ?? '');
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync when lead changes
  useEffect(() => {
    setNotes(lead.internalNotes ?? '');
    setAssignedTo(lead.assignedTo ?? '');
    setDirty(false);
  }, [lead.id, lead.internalNotes, lead.assignedTo]);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await onUpdate({ internalNotes: notes, assignedTo: assignedTo || null });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const statusCfg = STATUS_CONFIG[lead.status as LeadStatus];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <User className="w-4 h-4 text-slate-600" />
          </div>
          <h2 className="font-bold text-slate-800 text-sm">פרטי ליד</h2>
        </div>

        {/* Lead card */}
        <div className="bg-surface-subtle rounded-xl p-3 space-y-2.5">
          <InfoRow icon={<User className="w-3.5 h-3.5" />} label="שם">
            <span className="font-semibold text-slate-800">{lead.name}</span>
          </InfoRow>

          <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="טלפון">
            <span className="font-mono text-slate-700 text-xs" dir="ltr">
              +{lead.phone}
            </span>
          </InfoRow>

          <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="הודעה אחרונה">
            <span className="text-slate-600">
              {formatTime(lead.lastMessageAt)}
            </span>
          </InfoRow>

          <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="נוצר">
            <span className="text-slate-600">
              {new Date(lead.createdAt).toLocaleDateString('he-IL')}
            </span>
          </InfoRow>
        </div>
      </div>

      {/* Priority */}
      <div className="px-4 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            עדיפות
          </span>
        </div>
        <div className="flex gap-2">
          {ALL_PRIORITIES.map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            const isActive = lead.priority === p;
            return (
              <button
                key={p}
                onClick={() => onUpdate({ priority: p })}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition',
                  isActive
                    ? cn(
                        cfg.color,
                        'border-current bg-opacity-10',
                        p === 'High'
                          ? 'bg-red-50 border-red-300'
                          : p === 'Med'
                          ? 'bg-amber-50 border-amber-300'
                          : 'bg-slate-100 border-slate-300'
                      )
                    : 'border-surface-border text-slate-400 hover:bg-surface-subtle'
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status */}
      <div className="px-4 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn('w-2 h-2 rounded-full', statusCfg.dot)} />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            סטטוס
          </span>
        </div>
        <span className={cn('status-badge', statusCfg.color, statusCfg.bg)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
          {statusCfg.label}
        </span>
      </div>

      {/* Assigned To */}
      <div className="px-4 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            מוקצה לנציג
          </span>
        </div>
        <input
          type="text"
          value={assignedTo}
          onChange={(e) => {
            setAssignedTo(e.target.value);
            setDirty(true);
          }}
          placeholder="שם הנציג..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
        />
      </div>

      {/* Internal Notes */}
      <div className="px-4 py-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <StickyNote className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            הערות פנימיות
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setDirty(true);
          }}
          placeholder="הוסף הערות פנימיות על הליד (לא יישלח ללקוח)..."
          className="flex-1 w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-none leading-relaxed min-h-[120px]"
        />

        <button
          onClick={handleSaveNotes}
          disabled={!dirty || saving}
          className={cn(
            'mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-semibold transition',
            dirty && !saving
              ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          )}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
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

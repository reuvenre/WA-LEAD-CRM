'use client';

import { useState } from 'react';
import { Search, Users, ChevronDown, Plus, DownloadCloud, Loader2, CheckSquare, Trash2, X } from 'lucide-react';
import { cn, STATUS_CONFIG, formatTime, ALL_STATUSES } from '@/lib/utils';
import type { Lead, LeadStatus } from '@/types';

interface LeadListProps {
  leads: Lead[];
  loading: boolean;
  selectedId: string | null;
  statusFilter: string;
  search: string;
  onSelect: (id: string) => void;
  onStatusFilterChange: (status: string) => void;
  onSearchChange: (search: string) => void;
  onAddLead?: () => void;
  onImportWhatsapp?: () => void;
  importing?: boolean;
  onBulkDelete?: (ids: string[]) => Promise<void>;
}

export function LeadList({
  leads,
  loading,
  selectedId,
  statusFilter,
  search,
  onSelect,
  onStatusFilterChange,
  onSearchChange,
  onAddLead,
  onImportWhatsapp,
  importing,
  onBulkDelete,
}: LeadListProps) {
  // Multi-select mode for bulk deleting contacts.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exitSelect = () => { setSelecting(false); setSelected(new Set()); };

  const allVisibleSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleAll = () =>
    setSelected((prev) => (allVisibleSelected ? new Set() : new Set(leads.map((l) => l.id))));

  const doDelete = async () => {
    if (!onBulkDelete || selected.size === 0 || deleting) return;
    setDeleting(true);
    try {
      await onBulkDelete([...selected]);
      exitSelect();
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-surface-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-slate-800">לידים</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 bg-surface-subtle px-2 py-0.5 rounded-full">
              {leads.length}
            </span>
            {onBulkDelete && leads.length > 0 && (
              <button
                onClick={() => (selecting ? exitSelect() : setSelecting(true))}
                className={cn('w-7 h-7 flex items-center justify-center rounded-lg border transition',
                  selecting ? 'bg-brand-600 border-brand-600 text-white' : 'border-surface-border text-slate-500 hover:bg-surface-subtle')}
                title="בחירה מרובה"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
            )}
            {onImportWhatsapp && (
              <button
                onClick={onImportWhatsapp}
                disabled={importing}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-surface-border text-slate-500 hover:bg-surface-subtle transition disabled:opacity-60 disabled:cursor-wait"
                title="ייבוא אנשי קשר מוואטסאפ"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              </button>
            )}
            {onAddLead && (
              <button
                onClick={onAddLead}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition"
                title="הוסף ליד"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bulk-select action bar */}
        {selecting && (
          <div className="flex items-center gap-2 mb-3 bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5">
            <button onClick={toggleAll} className="text-xs font-semibold text-brand-700 hover:underline whitespace-nowrap">
              {allVisibleSelected ? 'נקה הכל' : 'בחר הכל'}
            </button>
            <span className="text-xs text-slate-500">נבחרו {selected.size}</span>
            <div className="mr-auto flex items-center gap-1.5">
              <button onClick={doDelete} disabled={selected.size === 0 || deleting}
                className="flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg px-2.5 py-1.5">
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                מחק
              </button>
              <button onClick={exitSelect} aria-label="בטל" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="חיפוש לפי שם או טלפון..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full appearance-none pr-3 pl-8 py-1.5 text-sm rounded-lg border border-surface-border bg-surface-muted text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 transition cursor-pointer"
          >
            <option value="all">כל הסטטוסים</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute top-1/2 -translate-y-1/2 left-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Lead items */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <LeadListSkeleton />
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <Users className="w-8 h-8 text-slate-300" />
            <span>לא נמצאו לידים</span>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadItem
              key={lead.id}
              lead={lead}
              isSelected={lead.id === selectedId}
              selecting={selecting}
              checked={selected.has(lead.id)}
              onClick={() => (selecting ? toggle(lead.id) : onSelect(lead.id))}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LeadItem({
  lead,
  isSelected,
  selecting,
  checked,
  onClick,
}: {
  lead: Lead;
  isSelected: boolean;
  selecting?: boolean;
  checked?: boolean;
  onClick: () => void;
}) {
  const statusCfg = STATUS_CONFIG[lead.status as LeadStatus];
  const lastMsg = lead.messages?.[0];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-right px-4 py-3 flex items-start gap-3 transition-colors border-b border-surface-border/60 hover:bg-surface-subtle',
        isSelected && !selecting && 'bg-brand-50 border-r-2 border-r-brand-600 hover:bg-brand-50',
        selecting && checked && 'bg-brand-50'
      )}
    >
      {/* Selection checkbox */}
      {selecting && (
        <span className={cn('flex-shrink-0 w-5 h-5 mt-2.5 rounded border flex items-center justify-center transition',
          checked ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 bg-white')}>
          {checked && <CheckSquare className="w-3.5 h-3.5" />}
        </span>
      )}
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white font-semibold text-sm">
        {lead.name.charAt(0)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-slate-800 truncate">{lead.name}</span>
          <span className="text-[11px] text-slate-400 flex-shrink-0">
            {formatTime(lead.lastMessageAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-slate-500 truncate leading-relaxed">
            {lastMsg
              ? (lastMsg.direction === 'outbound' ? '↩ ' : '') + lastMsg.content
              : lead.phone ?? ''}
          </p>
          <span
            className={cn(
              'status-badge flex-shrink-0',
              statusCfg.color,
              statusCfg.bg
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
            {statusCfg.label}
          </span>
        </div>
      </div>
    </button>
  );
}

function LeadListSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex gap-3 border-b border-surface-border/60">
          <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 bg-slate-200 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}

'use client';

import { useState } from 'react';
import { Phone, Clock, Tag, User, Flame, FolderKanban, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, STATUS_CONFIG, PRIORITY_CONFIG, formatTime } from '@/lib/utils';
import type { Lead, LeadStatus } from '@/types';
import { api } from '@/lib/api';

const KANBAN_STATUSES: LeadStatus[] = ['NEW', 'IN_PROGRESS', 'HOT', 'CLOSED', 'IRRELEVANT'];

interface KanbanBoardProps {
  leads: Lead[];
  onLeadClick: (id: string) => void;
  // Accepts a functional updater so optimistic changes/rollbacks compose with
  // concurrent socket-driven updates instead of overwriting the whole array.
  onLeadsChange: (updater: (prev: Lead[]) => Lead[]) => void;
}

export function KanbanBoard({ leads, onLeadClick, onLeadsChange }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);
  const [showLost, setShowLost] = useState(false);

  const lostLeads = leads.filter((l) => l.status === 'LOST');

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    if (!draggingId) return;

    const lead = leads.find((l) => l.id === draggingId);
    if (!lead || lead.status === newStatus) {
      setDraggingId(null);
      setDragOverStatus(null);
      return;
    }

    const id = draggingId;
    const previousStatus = lead.status;

    // Optimistic update — touch only the dragged lead.
    onLeadsChange((prev) => prev.map((l) => l.id === id ? { ...l, status: newStatus } : l));
    setDraggingId(null);
    setDragOverStatus(null);

    try {
      await api.leads.update(id, { status: newStatus });
    } catch {
      // Revert only this lead, preserving any updates that arrived meanwhile.
      onLeadsChange((prev) => prev.map((l) => l.id === id ? { ...l, status: previousStatus } : l));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main Kanban columns */}
      <div className="flex gap-3 flex-1 overflow-x-auto px-4 py-4 pb-2" dir="rtl">
        {KANBAN_STATUSES.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const columnLeads = leads.filter((l) => l.status === status);
          const isOver = dragOverStatus === status;

          return (
            <div
              key={status}
              className="flex-shrink-0 w-72 flex flex-col"
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => handleDrop(e, status)}
            >
              {/* Column Header */}
              <div className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0',
                cfg.bg, 'border-surface-border'
              )}>
                <div className="flex items-center gap-2">
                  {status === 'HOT' ? (
                    <Flame className="w-4 h-4 text-red-500" />
                  ) : (
                    <span className={cn('w-2.5 h-2.5 rounded-full', cfg.dot)} />
                  )}
                  <span className={cn('text-sm font-bold', cfg.color)}>{cfg.label}</span>
                </div>
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center',
                  cfg.color, 'bg-white/70'
                )}>
                  {columnLeads.length}
                </span>
              </div>

              {/* Cards area */}
              <div className={cn(
                'flex-1 overflow-y-auto rounded-b-xl border border-surface-border p-2 space-y-2 min-h-[200px] transition-all duration-200',
                isOver ? 'bg-brand-50/80 border-brand-300 shadow-inner' : 'bg-slate-50/50'
              )}>
                {columnLeads.map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    isDragging={draggingId === lead.id}
                    onClick={() => onLeadClick(lead.id)}
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                  />
                ))}

                {columnLeads.length === 0 && (
                  <div className={cn(
                    'flex items-center justify-center h-24 rounded-xl border-2 border-dashed text-xs transition-all',
                    isOver ? 'border-brand-400 text-brand-500 bg-brand-50' : 'border-slate-200 text-slate-400'
                  )}>
                    {isOver ? 'שחרר כאן' : 'ריק'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lost leads collapsed section */}
      {lostLeads.length > 0 && (
        <div className="px-4 pb-3" dir="rtl">
          <button onClick={() => setShowLost(!showLost)}
            className="w-full flex items-center justify-between px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition text-slate-500 text-xs font-semibold">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              הפסד ({lostLeads.length})
            </span>
            {showLost ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showLost && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {lostLeads.map((lead) => (
                <div key={lead.id} onClick={() => onLeadClick(lead.id)}
                  className="bg-white rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:shadow-sm transition opacity-70 hover:opacity-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-[10px] font-bold flex-shrink-0">
                      {lead.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-slate-600 truncate">{lead.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanCard({
  lead, isDragging, onClick, onDragStart, onDragEnd,
}: {
  lead: Lead;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const priorityCfg = PRIORITY_CONFIG[lead.priority];
  const priorityBorderColor =
    lead.priority === 'High' ? 'border-r-red-500' :
    lead.priority === 'Med' ? 'border-r-amber-400' : 'border-r-slate-300';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-surface-border border-r-[3px] p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-card hover:border-brand-200 transition-all group',
        priorityBorderColor,
        isDragging && 'opacity-40 scale-95 rotate-1'
      )}
    >
      {/* Top row: Avatar + Name + Priority */}
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
          {lead.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-slate-800 truncate leading-tight">{lead.name}</p>
          {lead.company && (
            <p className="text-[10px] text-slate-400 truncate">{lead.company}</p>
          )}
        </div>
        {lead.status === 'HOT' && (
          <Flame className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse" />
        )}
      </div>

      {/* Phone */}
      <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-2">
        <Phone className="w-3 h-3" />
        <span dir="ltr">{lead.phone}</span>
      </div>

      {/* Project badge */}
      {lead.project && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lead.project.color }} />
          <span className="text-[10px] font-medium text-slate-500 truncate">{lead.project.name}</span>
        </div>
      )}

      {/* Tags */}
      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-600 text-[9px] font-medium">
              <Tag className="w-2 h-2" />
              {tag}
            </span>
          ))}
          {lead.tags.length > 3 && (
            <span className="text-[9px] text-slate-400">+{lead.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer: priority, assigned, time */}
      <div className="flex items-center justify-between pt-1.5 border-t border-surface-border/50">
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
            lead.priority === 'High' ? 'bg-red-50 text-red-600' :
            lead.priority === 'Med' ? 'bg-amber-50 text-amber-600' :
            'bg-slate-50 text-slate-500'
          )}>
            {priorityCfg.label}
          </span>
          {lead.assignedTo && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <User className="w-2.5 h-2.5" />
              {lead.assignedTo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Clock className="w-2.5 h-2.5" />
          {formatTime(lead.lastMessageAt)}
        </div>
      </div>
    </div>
  );
}

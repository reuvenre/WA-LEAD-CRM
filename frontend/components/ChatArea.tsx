'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Phone,
  Zap,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Paperclip,
  FileText,
  ChevronRight,
  History,
  Loader2,
  CalendarClock,
  X,
} from 'lucide-react';
import { TemplateSelector } from './TemplateSelector';
import { cn, STATUS_CONFIG, formatFullTime, ALL_STATUSES } from '@/lib/utils';
import { api, type ScheduledMessage } from '@/lib/api';
import type { Lead, Message, LeadStatus } from '@/types';

interface ChatAreaProps {
  lead: Lead;
  messages: Message[];
  onSendMessage: (content: string) => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
  onLeadUpdate: (data: Partial<Lead>) => Promise<void>;
  onBack?: () => void;
  onNotify?: (msg: string) => void;
  onLoadHistory?: () => Promise<void>;
  schedulingEnabled?: boolean;
}

export function ChatArea({ lead, messages, onSendMessage, onSendFile, onLeadUpdate, onBack, onNotify, onLoadHistory, schedulingEnabled = true }: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    try {
      await onSendMessage(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplateSelect = useCallback((body: string) => {
    setInput(body);
    textareaRef.current?.focus();
  }, []);

  const handleLoadHistory = async () => {
    if (!onLoadHistory || loadingHistory) return;
    setLoadingHistory(true);
    try {
      await onLoadHistory();
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load this lead's pending scheduled messages (reset when switching leads).
  useEffect(() => {
    setScheduled([]);
    setShowScheduler(false);
    if (!schedulingEnabled) return;
    let stale = false;
    api.messages.listScheduled(lead.id).then((s) => { if (!stale) setScheduled(s); }).catch(() => {});
    return () => { stale = true; };
  }, [lead.id, schedulingEnabled]);

  const handleSchedule = async () => {
    const content = input.trim();
    if (!content) { onNotify?.('כתוב הודעה לפני התזמון'); return; }
    if (!scheduleAt) { onNotify?.('בחר תאריך ושעה'); return; }
    const when = new Date(scheduleAt);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) {
      onNotify?.('זמן השליחה חייב להיות בעתיד'); return;
    }
    try {
      const job = await api.messages.schedule(lead.id, content, when.toISOString());
      setScheduled((prev) => [...prev, job].sort((a, b) => a.runAt.localeCompare(b.runAt)));
      setInput('');
      setScheduleAt('');
      setShowScheduler(false);
      onNotify?.('ההודעה תוזמנה ✓');
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'התזמון נכשל');
    }
  };

  const cancelScheduled = async (id: string) => {
    setScheduled((prev) => prev.filter((s) => s.id !== id));
    await api.messages.cancelScheduled(id).catch(() => {});
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so picking the same file again re-fires onChange
    if (!file || uploading) return;
    // Validate up front — avoid reading a huge file into a base64 string (freezes the
    // tab) only to have the server reject it. Backend cap is 16MB.
    if (file.size === 0) { onNotify?.('הקובץ ריק'); return; }
    if (file.size > 16 * 1024 * 1024) { onNotify?.('הקובץ גדול מדי (מקסימום 16MB)'); return; }
    setUploading(true);
    try {
      await onSendFile(file);
    } finally {
      setUploading(false);
    }
  };

  const statusCfg = STATUS_CONFIG[lead.status as LeadStatus];

  return (
    <div className="flex flex-col h-full">
      {/* ── Chat Header ── */}
      <header className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-surface-border shadow-soft flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Back to list — mobile only */}
          {onBack && (
            <button onClick={onBack} aria-label="חזרה לרשימה" className="md:hidden w-8 h-8 -mr-1 flex items-center justify-center rounded-lg text-slate-500 hover:bg-surface-subtle">
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {lead.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base leading-tight">{lead.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500 font-mono" dir="ltr">
                {lead.phone ? `+${lead.phone}` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onLoadHistory && (
            <button
              onClick={handleLoadHistory}
              disabled={loadingHistory}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border border-surface-border text-slate-500 hover:bg-surface-subtle transition disabled:opacity-60 disabled:cursor-wait"
              title="טען את היסטוריית השיחה מוואטסאפ"
            >
              {loadingHistory
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <History className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{loadingHistory ? 'טוען…' : 'טען היסטוריה'}</span>
            </button>
          )}
          <StatusSelector
            current={lead.status as LeadStatus}
            onChange={(status) => onLeadUpdate({ status })}
          />
        </div>
      </header>

      {/* ── Message Feed ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 chat-bg">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500 bg-white/70 px-4 py-2 rounded-full">
              עדיין אין הודעות — שלח הודעה ראשונה
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                showTime={
                  i === messages.length - 1 ||
                  messages[i + 1]?.direction !== msg.direction
                }
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="flex-shrink-0 bg-white border-t border-surface-border px-4 py-3">
        {/* Pending scheduled messages for this conversation */}
        {scheduled.length > 0 && (
          <div className="mb-2 space-y-1">
            {scheduled.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="text-amber-800 font-medium flex-shrink-0">{formatFullTime(s.runAt)}</span>
                <span className="text-slate-600 truncate flex-1">{s.content}</span>
                <button onClick={() => cancelScheduled(s.id)} aria-label="בטל תזמון"
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-amber-100 text-amber-700 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Scheduler popover */}
        {showScheduler && (
          <div className="mb-2 flex items-center gap-2 bg-surface-subtle rounded-lg px-3 py-2">
            <CalendarClock className="w-4 h-4 text-brand-600 flex-shrink-0" />
            <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded-lg border border-surface-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={handleSchedule}
              className="text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 whitespace-nowrap">
              תזמן
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Templates button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-lg border transition',
                showTemplates
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'border-surface-border text-slate-500 hover:bg-surface-subtle'
              )}
              title="תבניות מהירות"
            >
              <Zap className="w-4 h-4" />
            </button>
            {showTemplates && (
              <TemplateSelector
                onSelect={handleTemplateSelect}
                onClose={() => setShowTemplates(false)}
                lead={lead}
              />
            )}
          </div>

          {/* Attach file (image / document) button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            className="hidden"
            onChange={handleFilePick}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg border border-surface-border transition flex-shrink-0',
              uploading
                ? 'text-slate-300 cursor-wait'
                : 'text-slate-500 hover:bg-surface-subtle'
            )}
            title="צירוף תמונה או מסמך"
          >
            {uploading ? <Clock className="w-4 h-4 animate-pulse" /> : <Paperclip className="w-4 h-4" />}
          </button>

          {/* Schedule (send later) button */}
          {schedulingEnabled && (
            <button
              onClick={() => setShowScheduler((v) => !v)}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-lg border transition flex-shrink-0',
                showScheduler ? 'bg-brand-600 border-brand-600 text-white' : 'border-surface-border text-slate-500 hover:bg-surface-subtle'
              )}
              title="תזמון שליחה"
            >
              <CalendarClock className="w-4 h-4" />
            </button>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="הקלד הודעה... (Enter לשליחה)"
            rows={1}
            style={{ resize: 'none' }}
            className="flex-1 min-h-[36px] max-h-32 px-3.5 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition leading-relaxed overflow-y-auto"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 128) + 'px';
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg transition flex-shrink-0',
              input.trim() && !sending
                ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 text-center">
          Shift+Enter לשורה חדשה
        </p>
      </div>
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────

// mediaUrl can originate from an inbound WhatsApp webhook (attacker-influenced), so
// only render http(s) or local blob: previews — never javascript:/data: in src/href.
function safeMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return /^(https?:|blob:)/i.test(url) ? url : undefined;
}

function MessageBubble({
  message,
  showTime,
}: {
  message: Message;
  showTime: boolean;
}) {
  const isOutbound = message.direction === 'outbound';
  const mediaSrc = safeMediaUrl(message.mediaUrl);

  return (
    <div
      className={cn(
        'flex message-enter',
        isOutbound ? 'justify-start' : 'justify-end'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-soft',
          isOutbound
            ? 'bg-white text-slate-800 rounded-tr-sm'
            : 'bg-brand-600 text-white rounded-tl-sm'
        )}
      >
        {message.type === 'image' && mediaSrc && (
          <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={mediaSrc}
              alt={message.fileName ?? 'תמונה'}
              className="rounded-lg max-w-full max-h-64 object-cover mb-1"
            />
          </a>
        )}
        {message.type === 'document' && mediaSrc && (
          <a
            href={mediaSrc}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg transition',
              isOutbound ? 'bg-surface-subtle hover:bg-slate-100' : 'bg-brand-700/40 hover:bg-brand-700/60'
            )}
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-medium underline break-all">
              {message.fileName ?? 'מסמך'}
            </span>
          </a>
        )}
        {message.content && (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {showTime && (
          <div
            className={cn(
              'flex items-center gap-1 mt-1',
              isOutbound ? 'justify-start' : 'justify-end'
            )}
          >
            <span
              className={cn(
                'text-[11px]',
                isOutbound ? 'text-slate-400' : 'text-brand-200'
              )}
            >
              {formatFullTime(message.timestamp)}
            </span>
            {isOutbound && <MessageStatusIcon status={message.status} />}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatusIcon({ status }: { status: Message['status'] }) {
  if (status === 'failed')
    return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  if (status === 'read')
    return <CheckCheck className="w-3.5 h-3.5 text-brand-500" />;
  if (status === 'delivered')
    return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
  if (status === 'sent')
    return <Check className="w-3.5 h-3.5 text-slate-400" />;
  return <Clock className="w-3 h-3 text-slate-300" />; // sending
}

// ─── Status Selector ───────────────────────────────────────────────────────

function StatusSelector({
  current,
  onChange,
}: {
  current: LeadStatus;
  onChange: (s: LeadStatus) => void;
}) {
  const cfg = STATUS_CONFIG[current];
  return (
    <div className="relative">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value as LeadStatus)}
        className={cn(
          'appearance-none pl-4 pr-3 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 transition',
          cfg.color,
          cfg.bg,
          'border-transparent'
        )}
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_CONFIG[s].label}
          </option>
        ))}
      </select>
    </div>
  );
}

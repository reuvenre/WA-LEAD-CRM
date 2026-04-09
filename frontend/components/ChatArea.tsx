'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Phone,
  Zap,
  CheckCheck,
  Check,
  Clock,
  Image as ImageIcon,
} from 'lucide-react';
import { TemplateSelector } from './TemplateSelector';
import { cn, STATUS_CONFIG, formatFullTime, ALL_STATUSES } from '@/lib/utils';
import type { Lead, Message, LeadStatus } from '@/types';

interface ChatAreaProps {
  lead: Lead;
  messages: Message[];
  onSendMessage: (content: string) => Promise<void>;
  onLeadUpdate: (data: Partial<Lead>) => Promise<void>;
}

export function ChatArea({ lead, messages, onSendMessage, onLeadUpdate }: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const statusCfg = STATUS_CONFIG[lead.status as LeadStatus];

  return (
    <div className="flex flex-col h-full">
      {/* ── Chat Header ── */}
      <header className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-surface-border shadow-soft flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {lead.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base leading-tight">{lead.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500 font-mono" dir="ltr">
                +{lead.phone}
              </span>
            </div>
          </div>
        </div>

        {/* Status selector */}
        <div className="flex items-center gap-3">
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
              />
            )}
          </div>

          {/* Image button */}
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-surface-border text-slate-500 hover:bg-surface-subtle transition flex-shrink-0"
            title="שלח תמונה"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

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

function MessageBubble({
  message,
  showTime,
}: {
  message: Message;
  showTime: boolean;
}) {
  const isOutbound = message.direction === 'outbound';

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
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
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
  if (status === 'read')
    return <CheckCheck className="w-3.5 h-3.5 text-brand-500" />;
  if (status === 'delivered')
    return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
  if (status === 'sent')
    return <Check className="w-3.5 h-3.5 text-slate-400" />;
  return <Clock className="w-3 h-3 text-slate-300" />;
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

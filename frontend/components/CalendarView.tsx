'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Calendar, Clock, User, Phone, X, Save, MessageSquare, LayoutGrid, FolderKanban, BarChart2, Plus, Search } from 'lucide-react';
import { cn, STATUS_CONFIG } from '@/lib/utils';
import { api } from '@/lib/api';
import type { LeadStatus } from '@/types';

// A Date → the value an <input type="datetime-local"> expects (local, no timezone).
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface CalendarMeeting {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  meetingDate: string;
  meetingNotes: string | null;
  assignedTo: string | null;
  project: { name: string; color: string } | null;
}

interface CalendarViewProps {
  onLeadClick: (id: string) => void;
  onNavigate: (view: string) => void;
}

export function CalendarView({ onLeadClick, onNavigate }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<CalendarMeeting | null>(null);
  const [editing, setEditing] = useState<CalendarMeeting | null>(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const loadMeetings = useCallback(() => {
    setLoading(true);
    api.leads.calendar(monthStr).then((data) => {
      setMeetings(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [monthStr]);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const goNext = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Sunday=0, we want Sunday first for Hebrew calendar
  const startDayOfWeek = firstDay.getDay();

  const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  const getMeetingsForDay = (day: number) => {
    return meetings.filter(m => {
      const d = new Date(m.meetingDate);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const selectedMeetings = selectedDay ? getMeetingsForDay(selectedDay) : [];

  return (
    <div className="flex flex-col h-full bg-surface-muted">
      {/* Nav tabs */}
      <div className="flex border-b border-surface-border px-4 pt-2 gap-1 bg-white flex-shrink-0">
        <NavTab onClick={() => onNavigate('chat')} icon={<MessageSquare className="w-3.5 h-3.5" />} label="שיחות" />
        <NavTab onClick={() => onNavigate('kanban')} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Pipeline" />
        <NavTab onClick={() => onNavigate('projects')} icon={<FolderKanban className="w-3.5 h-3.5" />} label="פרויקטים" />
        <NavTab active icon={<Calendar className="w-3.5 h-3.5" />} label="יומן" />
        <NavTab onClick={() => onNavigate('dashboard')} icon={<BarChart2 className="w-3.5 h-3.5" />} label="דשבורד" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-surface-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-600" />
          <h2 className="text-base font-bold text-slate-800">יומן פגישות</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition">
            <Plus className="w-3.5 h-3.5" /> קבע פגישה
          </button>
          <button onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition">
            היום
          </button>
          <button onClick={goPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
            {monthNames[month]} {year}
          </span>
          <button onClick={goNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Calendar grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-surface-border shadow-soft overflow-hidden">
              {/* Day names header */}
              <div className="grid grid-cols-7 border-b border-surface-border">
                {dayNames.map((d) => (
                  <div key={d} className="text-center py-2.5 text-xs font-bold text-slate-500 bg-slate-50">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: startDayOfWeek }, (_, i) => (
                  <div key={`empty-${i}`} className="min-h-[100px] border-b border-l border-surface-border bg-slate-50/50" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dayMeetings = getMeetingsForDay(day);
                  const isSelected = selectedDay === day;
                  const isTodayCell = isToday(day);

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'min-h-[100px] border-b border-l border-surface-border p-1.5 cursor-pointer transition-colors',
                        isSelected ? 'bg-brand-50 ring-2 ring-inset ring-brand-400' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1',
                        isTodayCell ? 'bg-brand-600 text-white' : 'text-slate-600'
                      )}>
                        {day}
                      </div>

                      {/* Meeting dots */}
                      <div className="space-y-0.5">
                        {dayMeetings.slice(0, 3).map((m) => (
                          <div key={m.id}
                            className={cn(
                              'rounded px-1 py-0.5 text-[9px] font-medium truncate cursor-pointer',
                              m.project ? '' : 'bg-brand-100 text-brand-700'
                            )}
                            style={m.project ? { backgroundColor: m.project.color + '20', color: m.project.color } : undefined}
                            onClick={(e) => { e.stopPropagation(); setDetail(m); }}
                          >
                            {new Date(m.meetingDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} {m.name}
                          </div>
                        ))}
                        {dayMeetings.length > 3 && (
                          <div className="text-[9px] text-slate-400 px-1">+{dayMeetings.length - 3} נוספים</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Side panel - selected day meetings */}
        {selectedDay && (
          <div className="w-72 bg-white border-r border-surface-border flex-shrink-0 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {selectedDay} {monthNames[month]}
                </h3>
                <p className="text-xs text-slate-400">{selectedMeetings.length} פגישות</p>
              </div>
              <button onClick={() => setSelectedDay(null)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedMeetings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">אין פגישות ביום זה</p>
                </div>
              ) : (
                selectedMeetings.map((m) => {
                  const cfg = STATUS_CONFIG[m.status as LeadStatus];
                  return (
                    <div key={m.id}
                      onClick={() => setDetail(m)}
                      className="rounded-xl border border-surface-border p-3 space-y-2 hover:shadow-sm hover:border-brand-200 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {m.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(m.meetingDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Phone className="w-3 h-3" />
                        <span dir="ltr">{m.phone}</span>
                      </div>

                      {m.project && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.project.color }} />
                          <span className="text-[10px] text-slate-500">{m.project.name}</span>
                        </div>
                      )}

                      {m.assignedTo && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <User className="w-2.5 h-2.5" />
                          {m.assignedTo}
                        </div>
                      )}

                      {m.meetingNotes && (
                        <p className="text-[10px] text-slate-400 line-clamp-2 bg-slate-50 rounded-lg px-2 py-1">
                          {m.meetingNotes}
                        </p>
                      )}

                      {cfg && (
                        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold', cfg.bg, cfg.color)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                          {cfg.label}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <NewMeetingModal
          defaultDate={selectedDay ? new Date(year, month, selectedDay, 12, 0) : null}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); loadMeetings(); }}
        />
      )}

      {detail && (
        <MeetingDetailsModal
          meeting={detail}
          onClose={() => setDetail(null)}
          onOpenChat={() => { const id = detail.id; setDetail(null); onLeadClick(id); }}
          onEdit={() => { setEditing(detail); setDetail(null); }}
          onCleared={() => { setDetail(null); loadMeetings(); }}
        />
      )}

      {editing && (
        <NewMeetingModal
          defaultDate={null}
          initial={{
            id: editing.id, name: editing.name, phone: editing.phone,
            when: toLocalInput(new Date(editing.meetingDate)), notes: editing.meetingNotes ?? '',
          }}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadMeetings(); }}
        />
      )}
    </div>
  );
}

// ─── Meeting details (opens on click instead of jumping to the chat) ───────────
function MeetingDetailsModal({ meeting, onClose, onOpenChat, onEdit, onCleared }: {
  meeting: CalendarMeeting;
  onClose: () => void;
  onOpenChat: () => void;
  onEdit: () => void;
  onCleared: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  const cfg = STATUS_CONFIG[meeting.status as LeadStatus];
  const d = new Date(meeting.meetingDate);
  const clear = async () => {
    setClearing(true);
    try { await api.leads.update(meeting.id, { meetingDate: null, meetingNotes: null }); onCleared(); }
    catch { setClearing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h3 className="font-bold text-slate-800 text-base">פרטי הפגישה</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white font-bold flex-shrink-0">
              {meeting.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{meeting.name}</p>
              <p className="text-xs text-slate-400 font-mono" dir="ltr">{meeting.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-700 bg-surface-muted rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 text-brand-600 flex-shrink-0" />
            {d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </div>

          {meeting.meetingNotes && (
            <div className="text-sm text-slate-600 bg-surface-muted rounded-lg px-3 py-2 whitespace-pre-line">{meeting.meetingNotes}</div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {cfg && (
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.bg, cfg.color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} /> {cfg.label}
              </span>
            )}
            {meeting.assignedTo && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><User className="w-3 h-3" /> {meeting.assignedTo}</span>
            )}
            {meeting.project && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meeting.project.color }} /> {meeting.project.name}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button onClick={onEdit} className="py-2 rounded-lg border border-surface-border text-sm font-semibold text-slate-700 hover:bg-surface-subtle transition">ערוך</button>
            <button onClick={onOpenChat} className="py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition flex items-center justify-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> פתח שיחה
            </button>
          </div>
          <button onClick={clear} disabled={clearing} className="w-full py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 transition">
            {clearing ? 'מבטל…' : 'בטל פגישה'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule a meeting: pick a client, set date/time, save onto the lead ──────
function NewMeetingModal({ defaultDate, initial, onClose, onSaved }: {
  defaultDate: Date | null;
  initial?: { id: string; name: string; phone: string | null; when: string; notes: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; phone: string | null }>>([]);
  const [selected, setSelected] = useState<{ id: string; name: string; phone: string | null } | null>(
    initial ? { id: initial.id, name: initial.name, phone: initial.phone } : null,
  );
  const [when, setWhen] = useState(initial?.when ?? (defaultDate ? toLocalInput(defaultDate) : ''));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Live search over the client/contact list (debounced).
  useEffect(() => {
    if (selected) return;
    const t = setTimeout(() => {
      api.leads.list({ search: query.trim() || undefined })
        .then((r) => setResults(r.leads.map((l) => ({ id: l.id, name: l.name, phone: l.phone }))))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query, selected]);

  const save = async () => {
    if (!selected) { setError('בחר לקוח מהרשימה'); return; }
    if (!when) { setError('בחר תאריך ושעה'); return; }
    setSaving(true); setError('');
    try {
      await api.leads.update(selected.id, { meetingDate: new Date(when).toISOString(), meetingNotes: notes.trim() || undefined });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירת הפגישה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h3 className="font-bold text-slate-800 text-base">{initial ? 'עריכת פגישה' : 'קביעת פגישה'}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Client picker */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">לקוח</label>
            {selected ? (
              <div className="flex items-center justify-between gap-2 bg-brand-50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{selected.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono" dir="ltr">{selected.phone}</p>
                </div>
                <button onClick={() => { setSelected(null); setQuery(''); }} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex-shrink-0">שנה</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3" />
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חפש לפי שם או טלפון…"
                    className="w-full pr-9 pl-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-surface-border divide-y divide-slate-100">
                  {results.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">אין תוצאות</p>
                  ) : results.map((l) => (
                    <button key={l.id} onClick={() => setSelected(l)}
                      className="w-full text-right px-3 py-2 hover:bg-surface-subtle transition flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700 truncate">{l.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono flex-shrink-0" dir="ltr">{l.phone}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">תאריך ושעה</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">הערות לפגישה</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="נושא הפגישה, כתובת הנכס…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-border bg-surface-muted resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center justify-center gap-1.5">
            <Save className="w-4 h-4" /> {saving ? 'שומר…' : 'שמור פגישה'}
          </button>
          <p className="text-[11px] text-slate-400 text-center">הפגישה תסונכרן אוטומטית ליומן Google (אם מחובר)</p>
        </div>
      </div>
    </div>
  );
}

function NavTab({ active, onClick, icon, label }: { active?: boolean; onClick?: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-t-lg transition border-b-2',
        active
          ? 'border-brand-600 text-brand-600 bg-brand-50'
          : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-surface-subtle'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

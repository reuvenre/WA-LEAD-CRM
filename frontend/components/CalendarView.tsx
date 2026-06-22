'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Calendar, Clock, User, Phone, X, Save, MessageSquare, LayoutGrid, FolderKanban, BarChart2 } from 'lucide-react';
import { cn, STATUS_CONFIG } from '@/lib/utils';
import { api } from '@/lib/api';
import type { LeadStatus } from '@/types';

interface CalendarMeeting {
  id: string;
  name: string;
  phone: string;
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

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  useEffect(() => {
    setLoading(true);
    api.leads.calendar(monthStr).then((data) => {
      setMeetings(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [monthStr]);

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
                            onClick={(e) => { e.stopPropagation(); onLeadClick(m.id); }}
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
                      onClick={() => onLeadClick(m.id)}
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

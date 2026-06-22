'use client';

import { useState, useEffect } from 'react';
import {
  FolderKanban, Plus, Trash2, Edit3, Users, X, Check, Palette,
  MessageSquare, LayoutGrid, BarChart2, Settings, LogOut,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Project, Lead } from '@/types';
import { cn, STATUS_CONFIG } from '@/lib/utils';
import type { LeadStatus } from '@/types';

const PROJECT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

interface ProjectsViewProps {
  onLeadClick: (id: string) => void;
  onNavigate?: (view: string) => void;
  onSettings?: () => void;
  onLogout?: () => void;
}

export function ProjectsView({ onLeadClick, onNavigate, onSettings, onLogout }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectLeads, setProjectLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6' });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setLoadingLeads(true);
      api.leads.list({ projectId: selectedProject }).then((r) => {
        setProjectLeads(r.leads);
        setLoadingLeads(false);
      });
    } else {
      setProjectLeads([]);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    const data = await api.projects.list();
    setProjects(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await api.projects.create({ name: form.name, description: form.description, color: form.color });
      setForm({ name: '', description: '', color: '#3B82F6' });
      setShowAdd(false);
      loadProjects();
    } catch {}
  };

  const handleEdit = async (id: string) => {
    if (!form.name.trim()) return;
    try {
      await api.projects.update(id, { name: form.name, description: form.description, color: form.color });
      setEditId(null);
      setForm({ name: '', description: '', color: '#3B82F6' });
      loadProjects();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    await api.projects.delete(id);
    if (selectedProject === id) setSelectedProject(null);
    loadProjects();
  };

  const startEdit = (p: Project) => {
    setEditId(p.id);
    setForm({ name: p.name, description: p.description ?? '', color: p.color });
    setShowAdd(false);
  };

  return (
    <div className="flex h-full bg-surface-muted overflow-hidden">
      {/* Left: Project list */}
      <div className="w-80 flex-shrink-0 bg-white border-l border-surface-border flex flex-col">
        {/* View switcher tabs */}
        {onNavigate && (
          <div className="flex border-b border-surface-border px-2 pt-2 gap-1">
            <button onClick={() => onNavigate('chat')}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-surface-subtle">
              <MessageSquare className="w-3.5 h-3.5" /> שיחות
            </button>
            <button onClick={() => onNavigate('kanban')}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-surface-subtle">
              <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 border-brand-600 text-brand-600 bg-brand-50">
              <FolderKanban className="w-3.5 h-3.5" /> פרויקטים
            </button>
            <button onClick={() => onNavigate('dashboard')}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-surface-subtle">
              <BarChart2 className="w-3.5 h-3.5" /> דשבורד
            </button>
          </div>
        )}

        <div className="px-4 py-3 bg-white border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-brand-600" />
            <h2 className="font-bold text-slate-800 text-sm">פרויקטים</h2>
            <span className="text-xs text-slate-400">({projects.length})</span>
          </div>
          <button onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: '', description: '', color: '#3B82F6' }); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Add/Edit form */}
        {(showAdd || editId) && (
          <div className="px-4 py-3 border-b border-surface-border bg-brand-50 space-y-2">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="שם הפרויקט..." autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="תיאור (אופציונלי)..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition" />
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={cn('w-5 h-5 rounded-full transition border-2',
                    form.color === c ? 'border-slate-700 scale-110' : 'border-transparent hover:scale-105')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => editId ? handleEdit(editId) : handleCreate()}
                className="flex-1 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1">
                <Check className="w-3 h-3" />
                {editId ? 'עדכן' : 'צור פרויקט'}
              </button>
              <button onClick={() => { setShowAdd(false); setEditId(null); }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold hover:bg-slate-200 transition">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">טוען...</div>
          ) : projects.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <FolderKanban className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-400">אין פרויקטים עדיין</p>
              <p className="text-xs text-slate-400">לחץ + להוספת פרויקט ראשון</p>
            </div>
          ) : (
            projects.map((p) => (
              <div key={p.id}
                onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}
                className={cn('px-4 py-3 border-b border-surface-border cursor-pointer hover:bg-surface-subtle transition group',
                  selectedProject === p.id && 'bg-brand-50 border-r-2 border-r-brand-500')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-semibold text-slate-800 truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 transition">
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-500">{p._count?.leads ?? 0} לידים</span>
                  {p.description && <span className="text-xs text-slate-400 truncate">· {p.description}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom buttons */}
        {(onSettings || onLogout) && (
          <div className="border-t border-surface-border p-3 space-y-1">
            {onSettings && (
              <button onClick={onSettings}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition">
                <Settings className="w-3.5 h-3.5" /> הגדרות אבטחה
              </button>
            )}
            {onLogout && (
              <button onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 transition">
                <LogOut className="w-3.5 h-3.5" /> יציאה מהמערכת
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Leads for selected project */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedProject ? (
          <>
            <div className="px-6 py-4 bg-white border-b border-surface-border flex items-center gap-3">
              {(() => {
                const proj = projects.find((p) => p.id === selectedProject);
                return proj ? (
                  <>
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: proj.color }} />
                    <h3 className="font-bold text-slate-800">{proj.name}</h3>
                    <span className="text-xs text-slate-400">({projectLeads.length} לידים)</span>
                  </>
                ) : null;
              })()}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingLeads ? (
                <div className="text-center text-sm text-slate-400 py-10">טוען לידים...</div>
              ) : projectLeads.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm text-slate-400">אין לידים בפרויקט זה</p>
                  <p className="text-xs text-slate-400">שייך לידים דרך פרטי הליד</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projectLeads.map((lead) => {
                    const sCfg = STATUS_CONFIG[lead.status as LeadStatus];
                    return (
                      <div key={lead.id} onClick={() => onLeadClick(lead.id)}
                        className="bg-white rounded-xl border border-surface-border p-4 hover:shadow-md transition cursor-pointer space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-slate-800">{lead.name}</span>
                          <span className={cn('status-badge text-[10px]', sCfg.color, sCfg.bg)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', sCfg.dot)} />
                            {sCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span dir="ltr">+{lead.phone}</span>
                          {lead.assignedTo && <span>🧑‍💼 {lead.assignedTo}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <FolderKanban className="w-16 h-16 text-slate-300" />
            <p className="text-base font-semibold text-slate-500">בחר פרויקט מהרשימה</p>
            <p className="text-sm">לחץ על פרויקט כדי לראות את הלידים המשויכים</p>
          </div>
        )}
      </div>
    </div>
  );
}

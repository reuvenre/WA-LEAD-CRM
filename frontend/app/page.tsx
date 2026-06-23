'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeadList } from '@/components/LeadList';
import { ChatArea } from '@/components/ChatArea';
import { LeadDetails } from '@/components/LeadDetails';
import { KanbanBoard } from '@/components/KanbanBoard';
import { Dashboard, usePrefetchDashboard } from '@/components/Dashboard';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import type { Lead, Message } from '@/types';
import { MessageSquare, LayoutGrid, BarChart2, LogOut, Settings, FolderKanban, Calendar, Shield, Building2, Home, Building, KeyRound, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddLeadModal } from '@/components/AddLeadModal';
import { SettingsModal } from '@/components/SettingsModal';
import { SuperAdminPanel } from '@/components/SuperAdminPanel';
import { useAuth } from '@/hooks/useAuth';
import { decodeToken } from '@/lib/auth';

import { ProjectsView } from '@/components/ProjectsView';
import { CalendarView } from '@/components/CalendarView';

// Real-estate domain modules (ported from the Real Estate Suite)
import DealFlow from '@/components/realestate/DealFlow';
import Properties from '@/components/realestate/Properties';
import ProjectsRE from '@/components/realestate/ProjectsRE';
import Listings from '@/components/realestate/Listings';

type ViewMode = 'chat' | 'kanban' | 'dashboard' | 'projects' | 'calendar' | 'deals' | 'properties' | 're_projects' | 'listings';

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [showAddLead, setShowAddLead] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const { ready, logout } = useAuth();
  const prefetchedDashboard = usePrefetchDashboard(ready);
  const currentUser = decodeToken();

  // ─── Load Leads ─────────────────────────────────────────────────────────────
  const loadLeads = useCallback(async () => {
    try {
      const data = await api.leads.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
      });
      setLeads(data.leads);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ─── Load Selected Lead ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLeadId) { setSelectedLead(null); setMessages([]); return; }
    api.leads.get(selectedLeadId).then((lead) => {
      setSelectedLead(lead);
      setMessages(lead.messages ?? []);
    });
  }, [selectedLeadId]);

  // ─── Socket.io ───────────────────────────────────────────────────────────────
  useSocket({
    onNewMessage: (message: Message) => {
      if (message.leadId === selectedLeadId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
      setLeads((prev) =>
        prev.map((l) => l.id === message.leadId ? { ...l, lastMessageAt: message.timestamp } : l)
      );
    },
    onLeadUpdated: (updatedLead: Lead) => {
      setLeads((prev) => prev.map((l) => l.id === updatedLead.id ? { ...l, ...updatedLead } : l));
      if (updatedLead.id === selectedLeadId) {
        setSelectedLead((prev) => prev ? { ...prev, ...updatedLead } : prev);
      }
    },
    onLeadCreated: (newLead: Lead) => {
      setLeads((prev) => prev.some((l) => l.id === newLead.id) ? prev : [newLead, ...prev]);
    },
  }, selectedLeadId ?? undefined);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSendMessage = async (content: string) => {
    if (!selectedLeadId) return;
    try {
      await api.messages.send(selectedLeadId, content);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'שליחת ההודעה נכשלה');
    }
  };

  const handleLeadUpdate = async (
    data: Partial<Pick<Lead, 'status' | 'priority' | 'internalNotes' | 'assignedTo' | 'tags'>>
  ) => {
    if (!selectedLeadId) return;
    const updated = await api.leads.update(selectedLeadId, data);
    setSelectedLead(updated);
    setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l));
  };

  const handleKanbanLeadClick = (id: string) => {
    setSelectedLeadId(id);
    setViewMode('chat');
  };

  const handleLeadDelete = async () => {
    if (!selectedLeadId) return;
    const id = selectedLeadId;
    await api.leads.delete(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedLeadId(null);
    setSelectedLead(null);
    setMessages([]);
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-muted">
        <div className="w-8 h-8 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted" dir="rtl">
      {/* ── Right Sidebar: Lead List (hidden when projects/dashboard fullscreen) ── */}
      {viewMode !== 'projects' && viewMode !== 'calendar' && (
        <aside className="w-80 flex-shrink-0 flex flex-col border-l border-surface-border bg-white shadow-soft">
          {/* View switcher */}
          <div className="flex flex-wrap border-b border-surface-border px-2 pt-2 gap-1">
            <ViewTab
              active={viewMode === 'chat'}
              onClick={() => setViewMode('chat')}
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              label="שיחות"
            />
            <ViewTab
              active={viewMode === 'kanban'}
              onClick={() => setViewMode('kanban')}
              icon={<LayoutGrid className="w-3.5 h-3.5" />}
              label="Pipeline"
            />
            <ViewTab
              active={false}
              onClick={() => setViewMode('projects')}
              icon={<FolderKanban className="w-3.5 h-3.5" />}
              label="פרויקטים"
            />
            <ViewTab
              active={false}
              onClick={() => setViewMode('calendar')}
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="יומן"
            />
            <ViewTab
              active={viewMode === 'dashboard'}
              onClick={() => setViewMode('dashboard')}
              icon={<BarChart2 className="w-3.5 h-3.5" />}
              label="דשבורד"
            />

            {/* ── נדל״ן (Real Estate) — second row ── */}
            <div className="basis-full h-px bg-surface-border my-1" />
            <ViewTab
              active={viewMode === 'deals'}
              onClick={() => setViewMode('deals')}
              icon={<Building2 className="w-3.5 h-3.5" />}
              label="עסקאות"
            />
            <ViewTab
              active={viewMode === 'properties'}
              onClick={() => setViewMode('properties')}
              icon={<Home className="w-3.5 h-3.5" />}
              label="נכסים"
            />
            <ViewTab
              active={viewMode === 're_projects'}
              onClick={() => setViewMode('re_projects')}
              icon={<Building className="w-3.5 h-3.5" />}
              label="בנייה"
            />
            <ViewTab
              active={viewMode === 'listings'}
              onClick={() => setViewMode('listings')}
              icon={<KeyRound className="w-3.5 h-3.5" />}
              label="דירות"
            />
          </div>

          <LeadList
            leads={leads}
            loading={loadingLeads}
            selectedId={selectedLeadId}
            statusFilter={statusFilter}
            search={search}
            onSelect={(id) => { setSelectedLeadId(id); setViewMode('chat'); }}
            onStatusFilterChange={setStatusFilter}
            onSearchChange={setSearch}
            onAddLead={() => setShowAddLead(true)}
          />
          <div className="border-t border-surface-border p-3 space-y-1">
            {currentUser?.role === 'SUPER_ADMIN' && (
              <button
                onClick={() => setShowSuperAdmin(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-purple-600 hover:bg-purple-50 hover:text-purple-700 transition font-semibold"
              >
                <Shield className="w-3.5 h-3.5" />
                ניהול מערכת
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <Settings className="w-3.5 h-3.5" />
              הגדרות אבטחה
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              יציאה מהמערכת
            </button>
          </div>
        </aside>
      )}

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {viewMode === 'deals' ? (
          <div className="flex-1 overflow-y-auto bg-surface-muted"><DealFlow /></div>
        ) : viewMode === 'properties' ? (
          <div className="flex-1 overflow-y-auto bg-surface-muted"><Properties /></div>
        ) : viewMode === 're_projects' ? (
          <div className="flex-1 overflow-y-auto bg-surface-muted"><ProjectsRE /></div>
        ) : viewMode === 'listings' ? (
          <div className="flex-1 overflow-y-auto bg-surface-muted"><Listings /></div>
        ) : viewMode === 'dashboard' ? (
          <Dashboard onClose={() => setViewMode('chat')} prefetchedData={prefetchedDashboard} />
        ) : viewMode === 'calendar' ? (
          <CalendarView onLeadClick={(id) => { setSelectedLeadId(id); setViewMode('chat'); }} onNavigate={(view) => setViewMode(view as ViewMode)} />
        ) : viewMode === 'projects' ? (
          <ProjectsView
            onLeadClick={(id) => { setSelectedLeadId(id); setViewMode('chat'); }}
            onNavigate={(view) => setViewMode(view as ViewMode)}
            onSettings={() => setShowSettings(true)}
            onLogout={logout}
          />
        ) : viewMode === 'kanban' ? (
          <div className="flex-1 overflow-hidden">
            <div className="px-4 py-3 bg-white border-b border-surface-border flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-brand-600" />
              <h2 className="font-bold text-slate-800 text-sm">Pipeline — תצוגת Kanban</h2>
              <span className="text-xs text-slate-400 mr-auto">גרור ליד בין עמודות לשינוי סטטוס</span>
            </div>
            <div className="h-[calc(100%-52px)] overflow-hidden">
              <KanbanBoard
                leads={leads}
                onLeadClick={handleKanbanLeadClick}
                onLeadsChange={setLeads}
              />
            </div>
          </div>
        ) : selectedLead ? (
          <ChatArea
            lead={selectedLead}
            messages={messages}
            onSendMessage={handleSendMessage}
            onLeadUpdate={handleLeadUpdate}
          />
        ) : (
          <EmptyState onAddLead={() => setShowAddLead(true)} />
        )}
      </main>

      {/* ── Left Sidebar: Lead Details ── */}
      {selectedLead && viewMode === 'chat' && (
        <aside className="w-72 flex-shrink-0 border-r border-surface-border bg-white shadow-soft overflow-hidden flex flex-col">
          <LeadDetails lead={selectedLead} onUpdate={handleLeadUpdate} onDelete={handleLeadDelete} />
        </aside>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onLeadAdded={(lead) => {
            // Show the new lead immediately (socket 'lead:created' may not reach the creator).
            setLeads((prev) => prev.some((l) => l.id === lead.id) ? prev : [lead, ...prev]);
            setShowAddLead(false);
          }}
          onLeadsImported={(count) => {
            if (count > 0) loadLeads();
            setShowAddLead(false);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onAddLead }: { onAddLead?: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="w-20 h-20 rounded-full bg-surface-subtle flex items-center justify-center">
        <MessageSquare className="w-10 h-10 text-slate-300" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-500">בחר שיחה לצפייה</p>
        <p className="text-sm mt-1">בחר איש קשר מהרשימה, או הוסף איש קשר חדש כדי להתחיל שיחה</p>
      </div>
      {onAddLead && (
        <button
          onClick={onAddLead}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-soft"
        >
          <UserPlus className="w-4 h-4" />
          הוסף איש קשר חדש
        </button>
      )}
    </div>
  );
}

function ViewTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
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

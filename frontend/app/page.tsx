'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LeadList } from '@/components/LeadList';
import { ChatArea } from '@/components/ChatArea';
import { LeadDetails } from '@/components/LeadDetails';
import { KanbanBoard } from '@/components/KanbanBoard';
import { Dashboard, usePrefetchDashboard } from '@/components/Dashboard';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import type { Lead, Message } from '@/types';
import { MessageSquare, LayoutGrid, UserPlus } from 'lucide-react';
import { AddLeadModal } from '@/components/AddLeadModal';
import { SettingsModal } from '@/components/SettingsModal';
import { SuperAdminPanel } from '@/components/SuperAdminPanel';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/hooks/useAuth';
import { decodeToken } from '@/lib/auth';

import { ProjectsView } from '@/components/ProjectsView';
import { CalendarView } from '@/components/CalendarView';

// Real-estate domain modules (ported from the Real Estate Suite)
import DealFlow from '@/components/realestate/DealFlow';
import Properties from '@/components/realestate/Properties';
import ProjectsRE from '@/components/realestate/ProjectsRE';
import Listings from '@/components/realestate/Listings';
import REClients from '@/components/realestate/REClients';

type ViewMode = 'chat' | 'kanban' | 'dashboard' | 'projects' | 'calendar' | 'deals' | 'properties' | 're_projects' | 'listings' | 'clients';

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Always-current selected lead id, so async send-reconciliation never appends a
  // message into a chat the user has since switched away from.
  const selectedLeadIdRef = useRef<string | null>(null);
  useEffect(() => { selectedLeadIdRef.current = selectedLeadId; }, [selectedLeadId]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  // Agents open on WhatsApp (their conversations); managers open on the dashboard.
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (decodeToken()?.role === 'AGENT' ? 'chat' : 'dashboard')
  );
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
    // Clear immediately so the previous lead's messages don't linger, and guard against
    // out-of-order responses when switching leads quickly (stale fetch is ignored).
    let stale = false;
    setSelectedLead(null);
    setMessages([]);
    api.leads.get(selectedLeadId).then((lead) => {
      if (stale) return;
      setSelectedLead(lead);
      setMessages(lead.messages ?? []);
    }).catch(() => { /* 401 handled globally; transient errors leave the pane empty */ });
    return () => { stale = true; };
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
    onMessageStatus: ({ id, status }) => {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
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
    const leadId = selectedLeadId;
    if (!leadId) return;

    // Optimistic: show the message instantly (status "sending") instead of waiting
    // for the Green API round-trip, then reconcile with the real one.
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: tempId, leadId, content, type: 'text',
      direction: 'outbound', status: 'sending', timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, lastMessageAt: optimistic.timestamp } : l));

    try {
      const { message } = await api.messages.send(leadId, content);
      // If the user switched leads mid-send, don't inject this into the now-visible chat.
      if (selectedLeadIdRef.current !== leadId) return;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        // The socket NEW_MESSAGE may already have appended the real message.
        if (withoutTemp.some((m) => m.id === message.id)) return withoutTemp;
        return [...withoutTemp, message];
      });
    } catch (err) {
      if (selectedLeadIdRef.current === leadId) {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: 'failed' } : m));
      }
      alert(err instanceof Error ? err.message : 'שליחת ההודעה נכשלה');
    }
  };

  const handleSendFile = async (file: File) => {
    const leadId = selectedLeadId;
    if (!leadId) return;

    const isImage = file.type.startsWith('image/');
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    // Local preview so images appear instantly while the upload is in flight.
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    const optimistic: Message = {
      id: tempId, leadId, content: '', type: isImage ? 'image' : 'document',
      mediaUrl: previewUrl, fileName: file.name,
      direction: 'outbound', status: 'sending', timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, lastMessageAt: optimistic.timestamp } : l));

    try {
      const { message } = await api.messages.sendFile(leadId, file);
      // Real message carries the hosted URL; drop the local preview either way.
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      // Don't inject into a chat the user has since switched away from.
      if (selectedLeadIdRef.current !== leadId) return;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === message.id)) return withoutTemp;
        return [...withoutTemp, message];
      });
    } catch (err) {
      // Keep the preview on failure so the user still sees what they tried to send.
      if (selectedLeadIdRef.current === leadId) {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: 'failed' } : m));
      } else if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      alert(err instanceof Error ? err.message : 'שליחת הקובץ נכשלה');
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
    <div className="flex h-screen overflow-hidden bg-[#F4F6FB]" dir="rtl">
      {/* ── Primary navy sidebar (demo style) ── */}
      <AppSidebar
        viewMode={viewMode}
        onSelect={(v) => setViewMode(v)}
        userName={currentUser?.username}
        role={currentUser?.role}
        isSuperAdmin={currentUser?.role === 'SUPER_ADMIN'}
        onSettings={() => setShowSettings(true)}
        onSuperAdmin={() => setShowSuperAdmin(true)}
        onLogout={logout}
      />

      {/* ── Lead list — secondary panel, only in chat & pipeline ── */}
      {(viewMode === 'chat' || viewMode === 'kanban') && (
        <aside className="w-80 flex-shrink-0 flex flex-col border-l border-surface-border bg-white shadow-soft">
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
        ) : viewMode === 'clients' ? (
          <div className="flex-1 overflow-y-auto bg-surface-muted"><REClients /></div>
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
            onSendFile={handleSendFile}
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
      {showSuperAdmin && <SuperAdminPanel onClose={() => setShowSuperAdmin(false)} />}
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

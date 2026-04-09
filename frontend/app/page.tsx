'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeadList } from '@/components/LeadList';
import { ChatArea } from '@/components/ChatArea';
import { LeadDetails } from '@/components/LeadDetails';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import type { Lead, Message } from '@/types';
import { MessageSquare } from 'lucide-react';

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // ─── Load Leads ────────────────────────────────────────────────────────────
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

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // ─── Load Selected Lead ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLeadId) {
      setSelectedLead(null);
      setMessages([]);
      return;
    }

    api.leads.get(selectedLeadId).then((lead) => {
      setSelectedLead(lead);
      setMessages(lead.messages ?? []);
    });
  }, [selectedLeadId]);

  // ─── Socket.io ─────────────────────────────────────────────────────────────
  useSocket(
    {
      onNewMessage: (message: Message) => {
        // Add message if it's for the active lead
        if (message.leadId === selectedLeadId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
        }
        // Update lastMessageAt in leads list
        setLeads((prev) =>
          prev.map((l) =>
            l.id === message.leadId
              ? { ...l, lastMessageAt: message.timestamp }
              : l
          )
        );
      },
      onLeadUpdated: (updatedLead: Lead) => {
        setLeads((prev) =>
          prev.map((l) => (l.id === updatedLead.id ? { ...l, ...updatedLead } : l))
        );
        if (updatedLead.id === selectedLeadId) {
          setSelectedLead((prev) => (prev ? { ...prev, ...updatedLead } : prev));
        }
      },
      onLeadCreated: (newLead: Lead) => {
        setLeads((prev) => [newLead, ...prev]);
      },
    },
    selectedLeadId ?? undefined
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSendMessage = async (content: string) => {
    if (!selectedLeadId) return;
    // Don't add to state here — socket event will handle it to avoid duplicates
    await api.messages.send(selectedLeadId, content);
  };

  const handleLeadUpdate = async (
    data: Partial<Pick<Lead, 'status' | 'priority' | 'internalNotes' | 'assignedTo'>>
  ) => {
    if (!selectedLeadId) return;
    const updated = await api.leads.update(selectedLeadId, data);
    setSelectedLead(updated);
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted" dir="rtl">
      {/* ── Right Sidebar: Lead List ── */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-l border-surface-border bg-white shadow-soft">
        <LeadList
          leads={leads}
          loading={loadingLeads}
          selectedId={selectedLeadId}
          statusFilter={statusFilter}
          search={search}
          onSelect={setSelectedLeadId}
          onStatusFilterChange={setStatusFilter}
          onSearchChange={setSearch}
        />
      </aside>

      {/* ── Main: Chat Area ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedLead ? (
          <ChatArea
            lead={selectedLead}
            messages={messages}
            onSendMessage={handleSendMessage}
            onLeadUpdate={handleLeadUpdate}
          />
        ) : (
          <EmptyState />
        )}
      </main>

      {/* ── Left Sidebar: Lead Details ── */}
      {selectedLead && (
        <aside className="w-72 flex-shrink-0 border-r border-surface-border bg-white shadow-soft overflow-y-auto">
          <LeadDetails lead={selectedLead} onUpdate={handleLeadUpdate} />
        </aside>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="w-20 h-20 rounded-full bg-surface-subtle flex items-center justify-center">
        <MessageSquare className="w-10 h-10 text-slate-300" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-500">בחר ליד לצפייה בשיחה</p>
        <p className="text-sm mt-1">בחר ליד מהרשימה כדי להתחיל</p>
      </div>
    </div>
  );
}

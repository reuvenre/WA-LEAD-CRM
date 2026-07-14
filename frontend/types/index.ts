export type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'HOT' | 'CLOSED' | 'LOST' | 'IRRELEVANT';
export type Priority = 'Low' | 'Med' | 'High';
export type LeadChannel = 'WHATSAPP' | 'WEBCHAT' | 'INSTAGRAM' | 'MESSENGER';
export type MessageType = 'text' | 'image' | 'document';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  _count?: { leads: number };
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  // Null for non-WhatsApp channels (webchat / Instagram / Messenger contacts have no phone)
  phone: string | null;
  channel: LeadChannel;
  externalId?: string | null;
  status: LeadStatus;
  priority: Priority;
  projectId: string | null;
  project?: Project | null;
  lastMessageAt: string | null;
  internalNotes: string | null;
  assignedTo: string | null;
  tags: string[];
  meetingDate: string | null;
  meetingNotes: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
  activities?: Activity[];
}

export interface Message {
  id: string;
  leadId: string;
  content: string;
  type: MessageType;
  mediaUrl?: string | null;
  fileName?: string | null;
  direction: MessageDirection;
  status: MessageStatus;
  timestamp: string;
  lead?: Lead;
}

export interface Template {
  id: string;
  title: string;
  body: string;
  category: string;
}

export interface Activity {
  id: string;
  leadId: string;
  actor: string;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface AnalyticsOverview {
  totals: {
    leads: number;
    newToday: number;
    hot: number;
    closed: number;
    lost: number;
    inProgress: number;
  };
  messages: {
    today: number;
    thisWeek: number;
  };
  avgResponseMinutes: number | null;
  slaTargetMinutes: number;
  slaCompliance: number | null;
  leadsByStatus: Array<{ status: string; count: number }>;
  leadsThisWeek: Array<{ day: string; count: number }>;
  agents: Array<{ name: string; leads: number; avgResponseMinutes: number | null; slaCompliance: number | null }>;
  projects: Array<{ id: string; name: string; color: string; leads: number }>;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
}

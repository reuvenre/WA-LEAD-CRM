export type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'HOT' | 'CLOSED' | 'LOST' | 'IRRELEVANT';
export type Priority = 'Low' | 'Med' | 'High';
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
  phone: string;
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
  leadsByStatus: Array<{ status: string; count: number }>;
  leadsThisWeek: Array<{ day: string; count: number }>;
  agents: Array<{ name: string; leads: number }>;
  projects: Array<{ id: string; name: string; color: string; leads: number }>;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
}

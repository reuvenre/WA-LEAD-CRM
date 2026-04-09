export type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'HOT' | 'CLOSED' | 'LOST';
export type Priority = 'Low' | 'Med' | 'High';
export type MessageType = 'text' | 'image';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  priority: Priority;
  lastMessageAt: string | null;
  internalNotes: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  leadId: string;
  content: string;
  type: MessageType;
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

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
}

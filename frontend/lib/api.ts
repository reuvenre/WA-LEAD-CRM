import type { Lead, Message, Template, LeadsResponse } from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  leads: {
    list: (params?: { status?: string; search?: string; page?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.page) qs.set('page', String(params.page));
      return request<LeadsResponse>(`/api/leads?${qs}`);
    },

    get: (id: string) => request<Lead & { messages: Message[] }>(`/api/leads/${id}`),

    update: (id: string, data: Partial<Pick<Lead, 'status' | 'priority' | 'internalNotes' | 'assignedTo'>>) =>
      request<Lead>(`/api/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      request<void>(`/api/leads/${id}`, { method: 'DELETE' }),
  },

  messages: {
    list: (leadId: string) => request<Message[]>(`/api/messages/${leadId}`),

    send: (leadId: string, content: string, type: 'text' | 'image' = 'text') =>
      request<{ message: Message }>('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify({ leadId, content, type }),
      }),
  },

  templates: {
    list: () => request<Template[]>('/api/templates'),
    create: (data: Omit<Template, 'id'>) =>
      request<Template>('/api/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/api/templates/${id}`, { method: 'DELETE' }),
  },
};

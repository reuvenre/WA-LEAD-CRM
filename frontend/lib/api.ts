import type { Lead, Message, Template, Project, LeadsResponse, AnalyticsOverview } from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('crm_token') ?? '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  leads: {
    list: (params?: { status?: string; search?: string; page?: number; tags?: string; projectId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.tags) qs.set('tags', params.tags);
      if (params?.projectId) qs.set('projectId', params.projectId);
      return request<LeadsResponse>(`/api/leads?${qs}`);
    },
    get: (id: string) => request<Lead & { messages: Message[] }>(`/api/leads/${id}`),
    create: (data: { name: string; phone: string; email?: string; company?: string; status?: string; priority?: string; assignedTo?: string; internalNotes?: string; tags?: string[] }) =>
      request<Lead>('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
    import: (leads: Array<{ name: string; phone: string; status?: string; priority?: string; assignedTo?: string; tags?: string }>) =>
      request<{ created: number; skipped: number; errors: string[] }>('/api/leads/import', { method: 'POST', body: JSON.stringify({ leads }) }),
    update: (id: string, data: Partial<Pick<Lead, 'status' | 'priority' | 'internalNotes' | 'assignedTo' | 'tags' | 'name' | 'email' | 'company' | 'projectId' | 'meetingDate' | 'meetingNotes'>>) =>
      request<Lead>(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/leads/${id}`, { method: 'DELETE' }),
    calendar: (month: string) => request<Array<{
      id: string; name: string; phone: string; status: string;
      meetingDate: string; meetingNotes: string | null; assignedTo: string | null;
      project: { name: string; color: string } | null;
    }>>(`/api/leads/calendar?month=${month}`),
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
      request<Template>('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/templates/${id}`, { method: 'DELETE' }),
  },

  analytics: {
    overview: () => request<AnalyticsOverview>('/api/analytics/overview'),
  },

  automations: {
    list: () => request<Array<{ id: string; name: string; url: string; events: string[]; active: boolean }>>('/api/automations'),
    create: (data: { name: string; url: string; events: string[] }) =>
      request('/api/automations', { method: 'POST', body: JSON.stringify(data) }),
    toggle: (id: string, active: boolean) =>
      request(`/api/automations/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    delete: (id: string) => request<void>(`/api/automations/${id}`, { method: 'DELETE' }),
  },

  projects: {
    list: () => request<Project[]>('/api/projects'),
    create: (data: { name: string; description?: string; color?: string }) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Pick<Project, 'name' | 'description' | 'color' | 'active'>>) =>
      request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },

  tenant: {
    settings: () => request<{
      id: string; name: string; email: string; plan: string;
      greenApiInstanceId: string | null; greenApiToken: string | null;
      greenApiWebhookUrl: string | null;
    }>('/api/tenant/settings'),
    updateGreenApi: (data: { greenApiInstanceId: string; greenApiToken: string; greenApiWebhookUrl?: string }) =>
      request('/api/tenant/green-api', { method: 'PATCH', body: JSON.stringify(data) }),
    testGreenApi: (data: { greenApiInstanceId: string; greenApiToken: string }) =>
      request<{ ok: boolean; state: string | null; error?: string }>('/api/tenant/green-api/test', { method: 'POST', body: JSON.stringify(data) }),
    listUsers: () => request<Array<{ id: string; username: string; role: string; active: boolean; createdAt: string }>>('/api/tenant/users'),
    createUser: (data: { username: string; password: string; role?: string }) =>
      request('/api/tenant/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: string, data: { active?: boolean; role?: string }) =>
      request(`/api/tenant/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateProfile: (data: { name: string; email: string }) =>
      request('/api/tenant/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  auth: {
    forgotPassword: (email: string) =>
      request<{ success: boolean; message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, newPassword: string) =>
      request<{ success: boolean; message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  },
};

import type { Lead, Message, Template, Project, LeadsResponse, AnalyticsOverview } from '@/types';

// ─── Real-estate DB row shapes (camelCase from the backend) ───────────────────
export interface DealRow { id: string; projectName: string; blockParcel: string | null; city: string | null; status: string; gdv: number; expectedMargin: number; riskAlert: boolean }
export interface PropertyRow { id: string; title: string; addressCity: string | null; priceRequested: number; status: string; exclusivityEndDate: string | null }
export interface REProjectRow {
  id: string; projectName: string; developer: string | null; city: string | null; neighborhood: string | null; address: string | null;
  status: string; expectedDelivery: string | null; deliveryEarliest: string | null; deliveryLatest: string | null;
  totalUnits: number; availableUnits: number | null; unitTypes: number[]; priceMin: number | null; priceMax: number | null;
  amenities: string[]; urbanRenewal: boolean; urbanRenewalType: string | null; salesOffice: string | null; source: string; sourceTier: number;
}
export interface ListingRow {
  id: string; title: string; type: string; city: string | null; neighborhood: string | null; street: string | null;
  rooms: number; floor: number; totalFloors: number; sizeSqm: number; price: number; parking: boolean; elevator: boolean; balcony: boolean;
  renovated: boolean; entry: string; status: string; agent: string | null; listedBy: string; source: string; sourceUrl: string | null;
}
export interface REClientRow { id: string; name: string; phone: string | null; city: string | null; rooms: number; budgetMax: number; deliveryBy: string | null; linkedToWhatsapp?: boolean }

export interface ScheduledMessage { id: string; runAt: string; content: string }

// Auto-reply configuration (greeting / off-hours / away), stored as JSON on the tenant.
export interface AutoRepliesConfig {
  greeting?: { enabled: boolean; text: string };
  offHours?: { enabled: boolean; text: string; days: number[]; from: string; to: string; tz?: string };
  away?: { enabled: boolean; text: string; delayMin: number };
}

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('crm_token') ?? '';
}

// Read a File into a base64 string (without the `data:...;base64,` prefix) so it
// can be sent as JSON to the backend, which forwards the bytes to Green API.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('קריאת הקובץ נכשלה'));
    reader.readAsDataURL(file);
  });
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
    // An expired/invalid token must not leave the app in a broken half-authenticated
    // shell where every call silently fails — clear it and bounce to login.
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('crm_token');
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
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
      id: string; name: string; phone: string | null; status: string;
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
    sendFile: async (leadId: string, file: File, caption = '') => {
      const fileBase64 = await fileToBase64(file);
      return request<{ message: Message }>('/api/messages/send-file', {
        method: 'POST',
        body: JSON.stringify({ leadId, fileBase64, fileName: file.name, mimeType: file.type, caption }),
      });
    },
    // Scheduled ("send later") messages.
    schedule: (leadId: string, content: string, sendAt: string) =>
      request<ScheduledMessage>('/api/messages/schedule', { method: 'POST', body: JSON.stringify({ leadId, content, sendAt }) }),
    listScheduled: (leadId: string) => request<ScheduledMessage[]>(`/api/messages/scheduled/${leadId}`),
    cancelScheduled: (jobId: string) => request<void>(`/api/messages/scheduled/${jobId}`, { method: 'DELETE' }),
  },

  // Pull existing WhatsApp data into the CRM.
  waImport: {
    // Bulk-create a lead per WhatsApp contact (manager only). Returns import counts.
    contacts: () => request<{ created: number; skipped: number; total: number; capReached: boolean }>(
      '/api/wa-import/contacts', { method: 'POST' }),
    // On-demand: load one chat's past messages into the given lead.
    history: (leadId: string, count?: number) => request<{ imported: number; skipped: number; total: number }>(
      `/api/wa-import/history/${leadId}`, { method: 'POST', body: JSON.stringify(count ? { count } : {}) }),
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

  realestate: {
    deals: {
      list: () => request<DealRow[]>('/api/realestate/deals'),
      create: (data: Partial<DealRow>) => request<DealRow>('/api/realestate/deals', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<DealRow>) => request<DealRow>(`/api/realestate/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/api/realestate/deals/${id}`, { method: 'DELETE' }),
    },
    properties: {
      list: () => request<PropertyRow[]>('/api/realestate/properties'),
      create: (data: Partial<PropertyRow>) => request<PropertyRow>('/api/realestate/properties', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<PropertyRow>) => request<PropertyRow>(`/api/realestate/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/api/realestate/properties/${id}`, { method: 'DELETE' }),
    },
    projects: {
      list: () => request<REProjectRow[]>('/api/realestate/projects'),
      create: (data: Partial<REProjectRow>) => request<REProjectRow>('/api/realestate/projects', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<REProjectRow>) => request<REProjectRow>(`/api/realestate/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/api/realestate/projects/${id}`, { method: 'DELETE' }),
    },
    listings: {
      list: () => request<ListingRow[]>('/api/realestate/listings'),
      search: (data: { city: string; rooms?: number | null; type?: string | null; maxPrice?: number | null }) =>
        request<ListingRow[]>('/api/realestate/listings/search', { method: 'POST', body: JSON.stringify(data) }),
      create: (data: Partial<ListingRow>) => request<ListingRow>('/api/realestate/listings', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<ListingRow>) => request<ListingRow>(`/api/realestate/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/api/realestate/listings/${id}`, { method: 'DELETE' }),
    },
    clients: {
      list: () => request<REClientRow[]>('/api/realestate/clients'),
      create: (data: Partial<REClientRow>) => request<REClientRow>('/api/realestate/clients', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<REClientRow>) => request<REClientRow>(`/api/realestate/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      remove: (id: string, deleteLead = false) => request<void>(`/api/realestate/clients/${id}${deleteLead ? '?deleteLead=true' : ''}`, { method: 'DELETE' }),
    },
  },

  tenant: {
    settings: () => request<{
      id: string; name: string; email: string; plan: string;
      greenApiInstanceId: string | null; greenApiTokenSet: boolean;
      greenApiWebhookUrl: string | null;
      assignmentMode: string; autoReplies: AutoRepliesConfig | null;
    }>('/api/tenant/settings'),
    updateEngagement: (data: { assignmentMode?: string; autoReplies?: AutoRepliesConfig | null }) =>
      request<{ success: boolean }>('/api/tenant/engagement', { method: 'PATCH', body: JSON.stringify(data) }),
    entitlements: () => request<{
      plan: string;
      entitlements: { features: Record<string, boolean> } & Record<string, unknown>;
      usage: { users: number; leads: number; lines: number };
    }>('/api/tenant/entitlements'),
    updateGreenApi: (data: { greenApiInstanceId: string; greenApiToken: string; greenApiWebhookUrl?: string }) =>
      request('/api/tenant/green-api', { method: 'PATCH', body: JSON.stringify(data) }),
    testGreenApi: (data: { greenApiInstanceId: string; greenApiToken: string }) =>
      request<{ ok: boolean; state: string | null; error?: string }>('/api/tenant/green-api/test', { method: 'POST', body: JSON.stringify(data) }),
    listUsers: () => request<Array<{ id: string; username: string; role: string; active: boolean; createdAt: string }>>('/api/tenant/users'),
    createUser: (data: { username: string; password: string; role?: string }) =>
      request('/api/tenant/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: string, data: { active?: boolean; role?: string }) =>
      request(`/api/tenant/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteUser: (id: string) =>
      request<void>(`/api/tenant/users/${id}`, { method: 'DELETE' }),
    updateProfile: (data: { name: string; email: string }) =>
      request('/api/tenant/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  google: {
    status: () => request<{ configured: boolean; connected: boolean; email: string | null }>('/api/google/status'),
    authUrl: () => request<{ url: string }>('/api/google/auth-url'),
    disconnect: () => request<{ success: boolean }>('/api/google/disconnect', { method: 'POST' }),
  },

  auth: {
    forgotPassword: (email: string) =>
      request<{ success: boolean; message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, newPassword: string) =>
      request<{ success: boolean; message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  },
};

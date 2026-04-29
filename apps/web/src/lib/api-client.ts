const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Gets the access token from cookie (browser only)
function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/access_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { message?: string }).message ?? response.statusText,
      body,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// Typed API client — mirrors the NestJS endpoints
export const api = {
  auth: {
    register: (data: unknown) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: unknown) =>
      request<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request('/auth/me'),
    logout: (refreshToken: string) =>
      request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
  },

  agents: {
    list: () => request('/agents'),
    get: (id: string) => request(`/agents/${id}`),
    create: (data: unknown) =>
      request('/agents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    setStatus: (id: string, status: string) =>
      request(`/agents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    stats: (id: string) => request(`/agents/${id}/stats`),
  },

  conversations: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/conversations${qs}`);
    },
    get: (id: string) => request(`/conversations/${id}`),
    escalate: (id: string, reason?: string) =>
      request(`/conversations/${id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    resolve: (id: string) =>
      request(`/conversations/${id}/resolve`, { method: 'POST' }),
    assign: (id: string, memberId: string) =>
      request(`/conversations/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      }),
    markRead: (id: string) =>
      request(`/conversations/${id}/read`, { method: 'POST' }),
  },

  messages: {
    list: (conversationId: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/conversations/${conversationId}/messages${qs}`);
    },
  },

  leads: {
    list: (status?: string) =>
      request(`/leads${status ? `?status=${status}` : ''}`),
    get: (id: string) => request(`/leads/${id}`),
    update: (id: string, data: unknown) =>
      request(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  contacts: {
    list: (search?: string) =>
      request(`/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    get: (id: string) => request(`/contacts/${id}`),
  },

  analytics: {
    overview: () => request('/analytics/overview'),
    byAgent: (agentId: string, days?: number) =>
      request(`/analytics/agents/${agentId}${days ? `?days=${days}` : ''}`),
  },

  billing: {
    plans: () => request('/billing/plans'),
    subscription: () => request('/billing/subscription'),
    checkout: (planId: string) =>
      request<{ url: string }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      }),
    portal: () =>
      request<{ url: string }>('/billing/portal', { method: 'POST' }),
  },

  organizations: {
    current: () => request('/organizations/current'),
    update: (data: unknown) =>
      request('/organizations/current', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    members: () => request('/organizations/members'),
  },
};

export { ApiError };

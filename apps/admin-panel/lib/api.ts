const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
const BASE = RAW_BASE.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
const TOKEN_KEY = 'bmf_admin_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    redirectToLogin();
    throw new Error('Session expired');
  }
  const raw = await res.text().catch(() => '');
  const parsed = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
  if (!res.ok) {
    const message = Array.isArray(parsed?.message)
      ? parsed.message.join(', ')
      : parsed?.message || raw || res.statusText || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return (parsed ?? (raw ? raw : {})) as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('bmf_admin_user');
  redirectToLogin();
};

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('bmf_admin_user') || 'null'); } catch { return null; }
};

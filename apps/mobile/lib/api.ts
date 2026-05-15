import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const configuredApiBase =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as any)?.apiUrl ||
  'http://localhost:3003';

export const API_BASE = String(configuredApiBase).replace(/\/+$/, '');

const webFallback = new Map<string, string>();

export const appStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return webFallback.get(key) ?? null;
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      webFallback.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      webFallback.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// ── Token helpers ───────────────────────────────────────────
export const getToken = () => appStorage.getItem('bmf_token');
export const getRefreshToken = () => appStorage.getItem('bmf_refresh');
export const setTokens = (access: string, refresh: string) =>
  Promise.all([
    appStorage.setItem('bmf_token', access),
    appStorage.setItem('bmf_refresh', refresh),
  ]);
export const clearTokens = () =>
  Promise.all([
    appStorage.deleteItem('bmf_token'),
    appStorage.deleteItem('bmf_refresh'),
  ]);
export const setUser = (user: any) =>
  appStorage.setItem('bmf_user', JSON.stringify(user));
export const getUser = async () => {
  const s = await appStorage.getItem('bmf_user');
  return s ? JSON.parse(s) : null;
};
export const logout = async () => {
  await clearTokens();
  await appStorage.deleteItem('bmf_user');
  router.replace('/login');
};

// ── Core fetch ──────────────────────────────────────────────
async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = path.startsWith('/auth/') ? null : await getToken();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    const body = await res.text().catch(() => '');
    let errMsg = 'Session expired';
    try {
      const d = JSON.parse(body);
      if (d?.message) errMsg = d.message;
    } catch {}
    // Only force-logout on non-auth endpoints (OTP/login legitimately returns 401 for bad codes)
    if (!path.startsWith('/auth/')) {
      await clearTokens();
      router.replace('/login');
    }
    throw new Error(errMsg);
  }

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) throw new Error(data?.message || data || `HTTP ${res.status}`);
  return data as T;
}

// ── Typed API ────────────────────────────────────────────────
export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ── Domain-specific helpers ──────────────────────────────────
export const authApi = {
  sendOtp: (phone: string) => api.post('/auth/otp/send', { phone }),
  verifyOtp: (phone: string, code: string, deviceId: string, name?: string) =>
    api.post('/auth/otp/verify', { phone, code, deviceId, name }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/users/me'),
};

export const gymsApi = {
  list: (params?: { city?: string; tier?: string; search?: string; page?: number; limit?: number; category?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.city) q.set('city', params.city);
    if (params?.tier) q.set('tier', params.tier);
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.category) q.set('category', params.category);
    if (params?.status) q.set('status', params.status);
    return api.get(`/gyms?${q.toString()}`);
  },
  getById: (id: string) => api.get(`/gyms/${id}`),
  categories: () => api.get('/master/categories'),
  recommended: () => api.get('/gyms/recommended'),
};

export const subscriptionsApi = {
  plans: () => api.get('/subscriptions/plans'),
  mySubscriptions: () => api.get('/subscriptions'),
  /** Purchase a subscription — creates DB record + Cashfree order */
  purchase: (body: {
    planType: 'day_pass' | 'same_gym' | 'multi_gym';
    gymId?: string;
    gymPlanId?: string;
    durationMonths: number;
    amountOverride?: number;
    isDayPass?: boolean;
    ptAddon?: boolean;
    ptDurationMonths?: number;
    ptTrainerId?: string;
    couponCode?: string;
  }) => api.post('/subscriptions/purchase', body),
  /** Legacy alias used in order.tsx - maps planId to planType */
  createOrder: (body: { planId: string; gymId?: string; gymPlanId?: string; durationMonths: number; couponCode?: string; ptAddon?: boolean; ptDurationMonths?: number; ptTrainerId?: string; totalAmount?: number; isDayPass?: boolean }) => {
    const planType = body.planId === 'multi_gym' ? 'multi_gym' : body.planId === 'day_pass' ? 'day_pass' : 'same_gym';
    return api.post('/subscriptions/purchase', {
      planType,
      gymId: (planType === 'same_gym' || planType === 'day_pass') ? body.gymId : undefined,
      gymPlanId: planType === 'same_gym' ? body.gymPlanId : undefined,
      durationMonths: body.isDayPass || planType === 'day_pass' ? 0 : body.durationMonths,
      couponCode: body.couponCode,
      ptAddon: body.ptAddon,
      ptDurationMonths: body.ptDurationMonths,
      ptTrainerId: body.ptTrainerId,
    });
  },
  /** @deprecated — do not call /payments/webhook from mobile; it is a server-to-server Cashfree webhook */
  verifyPayment: (body: { orderId: string; paymentId: string; signature: string }) =>
    api.post(`/subscriptions/${body.orderId}/verify`, body),
  verify: (subId: string) => api.post(`/subscriptions/${subId}/verify`, {}),
  invoice: (id: string) => api.get(`/subscriptions/${id}/invoice`),
};

export const gymPlansApi = {
  forGym: (gymId: string) => api.get(`/gym-plans/by-gym/${gymId}`),
};

export const qrApi = {
  getActiveBooking: () => api.get('/slots/active-booking'),
  /** Generate a 30-second membership check-in QR (subscription-based, no slot needed) */
  generate: (subscriptionId: string) =>
    api.post('/qr/generate', { subscriptionId }),
  validate: (qrToken: string, gymId: string) =>
    api.post('/qr/validate', { qrToken, gymId }),
  validateManual: (code: string, gymId: string) =>
    api.post('/qr/validate-manual', { code, gymId }),
};

export const checkinApi = {
  history: (limit = 50) => api.get(`/checkins/my-history?limit=${limit}`),
};

export const storeApi = {
  products: (category?: string) =>
    api.get(`/store/products${category ? `?category=${category}` : ''}`),
  createOrder: (items: { productId: string; quantity: number }[], address = '', phone = '') =>
    api.post('/store/orders', { items, address, phone }),
  myOrders: () => api.get('/store/orders'),
};

export const gymStaffApi = {
  myGym: () => api.get('/gyms/my-gym'),
  myMembers: () => api.get('/gyms/my-members'),
  myCheckins: (page = 1, limit = 20) => api.get(`/gyms/my-checkins?page=${page}&limit=${limit}`),
  todayStats: () => api.get('/checkins/today-count'),
  // Called by gym-portal scanner after decoding QR JWT to get member userId
  checkin: (userId: string) => api.post('/sessions/checkin', { userId }),
  settlements: () => api.get('/settlements/my-gym'),
};

export const miscApi = {
  notifications: () => api.get('/notifications'),
  markNotificationRead: (id: string) => api.post(`/notifications/${id}/read`),
  videos: () => api.get('/videos'),
  submitReview: (body: { targetType: 'gym' | 'trainer'; targetId: string; userId: string; stars: number; review?: string }) =>
    api.post('/ratings', body),
};

export const usersApi = {
  me: () => api.get('/users/me'),
  update: (body: { name?: string; email?: string }) => api.put('/users/me', body),
};

export const couponsApi = {
  validate: (code: string, amount: number, kind: string) =>
    api.post('/coupons/validate', { code, amount, kind }),
};

export const trainersApi = {
  listByGym: (gymId: string) => api.get(`/trainers?gymId=${gymId}`),
  get: (id: string) => api.get(`/trainers/${id}`),
  book: (trainerId: string, body: { userId: string; durationMonths: number; startDate: string; phone: string }) =>
    api.post(`/trainers/${trainerId}/book`, body),
};

export const wellnessApi = {
  list: (params?: { city?: string; serviceType?: string }) => {
    const q = params ? '?' + Object.entries(params).filter(([,v]) => v).map(([k, v]) => `${k}=${v}`).join('&') : '';
    return api.get(`/wellness/partners${q}`);
  },
  services: (partnerId: string) => api.get(`/wellness/partners/${partnerId}/services`),
  book: (body: { serviceId: string; bookingDate: string; phone?: string }) => {
    const { serviceId, ...rest } = body;
    return api.post(`/wellness/services/${serviceId}/book`, rest);
  },
};

export const slotsApi = {
  list: (gymId: string, date: string) => api.get(`/slots?gymId=${gymId}&date=${date}`),
  book: (slotId: string, subscriptionId?: string) => api.post(`/slots/${slotId}/book`, subscriptionId ? { subscriptionId } : {}),
  cancel: (slotId: string) => api.del(`/slots/${slotId}/book`),
  myBookings: () => api.get('/slots/my-bookings'),
  sessionsMyBookings: () => api.get('/sessions/my-bookings'),
};

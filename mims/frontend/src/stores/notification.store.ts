import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/constants';

// Socket.io connects to the server origin, not the REST prefix.
const WS_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
  entityType?: string | null;
  entityId?: string | null;
  sender?: { id: string; fullName: string } | null;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  connected: boolean;
  loaded: boolean;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  teardown: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  sendDirect: (payload: { recipientId: string; title: string; message: string }) => Promise<void>;
}

// Kept outside the store so they survive re-renders and stay singletons.
let socket: Socket | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let onFocus: (() => void) | null = null;

// How often to re-check over plain HTTP. This is the fallback that keeps the
// bell fresh when WebSockets can't traverse the proxy (e.g. cPanel/Apache); if
// the socket connects, updates still arrive instantly on top of this.
const POLL_MS = 30000;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  connected: false,
  loaded: false,

  init: async () => {
    // Load the initial list via the shared api client (fresh auth token).
    await get().refresh();
    set({ loaded: true });

    // Polling fallback: re-check on an interval and whenever the tab regains focus.
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          void get().refresh();
        }
      }, POLL_MS);
    }
    if (!onFocus && typeof window !== 'undefined') {
      onFocus = () => void get().refresh();
      window.addEventListener('focus', onFocus);
    }

    // Open the realtime channel once (instant updates when the proxy allows it).
    if (socket) return;
    const token = getAccessToken();
    if (!token) return;

    socket = io(`${WS_URL}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));

    socket.on('notification', (n: NotificationItem) => {
      set((s) => ({
        items: [n, ...s.items.filter((i) => i.id !== n.id)].slice(0, 50),
        unreadCount: s.unreadCount + (n.isRead ? 0 : 1),
      }));
    });

    socket.on('unread-count', (p: { unreadCount: number }) => {
      set({ unreadCount: p.unreadCount ?? 0 });
    });
  },

  // Pull the latest list + unread count over REST (works without WebSockets).
  refresh: async () => {
    try {
      const res = await api.get('/notifications', { params: { limit: 30 } });
      set({ items: res.data.items ?? [], unreadCount: res.data.unreadCount ?? 0 });
    } catch {
      /* transient — next tick retries */
    }
  },

  teardown: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (onFocus && typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocus);
      onFocus = null;
    }
    set({ connected: false });
  },

  markRead: async (id) => {
    const wasUnread = get().items.find((i) => i.id === id && !i.isRead);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, isRead: true } : i)),
      unreadCount: Math.max(0, s.unreadCount - (wasUnread ? 1 : 0)),
    }));
    try {
      await api.post(`/notifications/${id}/read`);
    } catch {
      /* optimistic — server will reconcile via unread-count events */
    }
  },

  markAllRead: async () => {
    set((s) => ({ items: s.items.map((i) => ({ ...i, isRead: true })), unreadCount: 0 }));
    try {
      await api.post('/notifications/read-all');
    } catch {
      /* optimistic */
    }
  },

  sendDirect: async ({ recipientId, title, message }) => {
    await api.post('/notifications', { recipientId, title, message });
  },
}));

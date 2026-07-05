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
  teardown: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  sendDirect: (payload: { recipientId: string; title: string; message: string }) => Promise<void>;
}

// Kept outside the store so it survives re-renders and stays a singleton.
let socket: Socket | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  connected: false,
  loaded: false,

  init: async () => {
    // Load the initial list via the shared api client (fresh auth token).
    try {
      const res = await api.get('/notifications', { params: { limit: 30 } });
      set({ items: res.data.items ?? [], unreadCount: res.data.unreadCount ?? 0, loaded: true });
    } catch {
      set({ loaded: true });
    }

    // Open the realtime channel once.
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

  teardown: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
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

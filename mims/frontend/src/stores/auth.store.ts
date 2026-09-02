/**
 * Authentication Store (Zustand)
 * Global state management for user authentication
 */

import { create } from 'zustand';
import type { User } from '@/lib/auth';
import { AUTH_TOKENS } from '@/lib/constants';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearUser: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKENS.ACCESS_TOKEN) : null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, error: null }),
  
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(AUTH_TOKENS.ACCESS_TOKEN, token);
      } else {
        localStorage.removeItem(AUTH_TOKENS.ACCESS_TOKEN);
      }
    }
    set({ token });
  },
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error, isLoading: false }),
  
  clearUser: () => set({ user: null, token: null, error: null }),
  
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKENS.ACCESS_TOKEN);
      // The super-admin's hospital selection is persisted, and nothing else
      // clears it. Left behind, it becomes the hospital context for whoever
      // logs in next on this browser.
      localStorage.removeItem('hospital-storage');
    }
    set({ user: null, token: null, error: null, isLoading: false });
  },
}));

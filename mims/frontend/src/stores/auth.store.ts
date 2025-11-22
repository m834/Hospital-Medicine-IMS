/**
 * Authentication Store (Zustand)
 * Global state management for user authentication
 */

import { create } from 'zustand';
import type { User } from '@/lib/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearUser: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, error: null }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error, isLoading: false }),
  
  clearUser: () => set({ user: null, error: null }),
  
  logout: () => {
    set({ user: null, error: null, isLoading: false });
  },
}));

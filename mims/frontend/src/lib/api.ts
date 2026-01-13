/**
 * API Client with Axios Interceptors
 * CRITICAL: Auto-logout on 401, auto-attach token, auto-refresh
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './constants';
import { getAccessToken, refreshAccessToken, clearAuthTokens } from './auth';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach token to every request
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = getAccessToken();

    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 and auto-logout
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized - attempt a single refresh and retry queued requests
    if (error.response?.status === 401 && originalRequest) {
      console.warn('[API] 401 Unauthorized - Token invalid or expired');

      if (!originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newAccessToken = await refreshAccessToken();

          if (newAccessToken) {
            if (originalRequest.headers) {
              // Support both header shapes
              (originalRequest.headers as any).Authorization = `Bearer ${newAccessToken}`;
            }
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('[API] Token refresh failed:', refreshError);
        }
      }

      // Refresh failed or no refresh token - logout user
      clearAuthTokens();

      // Redirect to login (only in browser)
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const redirectUrl = `/login?error=session_expired&redirect=${encodeURIComponent(currentPath)}`;
        window.location.href = redirectUrl;
      }

      return Promise.reject(error);
    }

    // Handle 403 Forbidden (insufficient permissions)
    if (error.response?.status === 403) {
      console.error('[API] 403 Forbidden - Insufficient permissions');

      if (typeof window !== 'undefined') {
        // Show unauthorized page or redirect
        window.location.href = '/unauthorized';
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('[API] Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;

// Typed API error
export interface APIError {
  message: string;
  statusCode?: number;
  error?: string;
}

/**
 * Extract error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as APIError;
    return apiError?.message || error.message || 'An error occurred';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred';
}

export { api };

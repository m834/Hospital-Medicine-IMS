/**
 * Authentication Utilities
 * CRITICAL: Prevents zero-data dashboard by validating tokens before rendering
 */

import { AUTH_TOKENS, API_BASE_URL } from './constants';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  requiresMFA?: boolean;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  hospitalId?: string; // NULL for SUPER_ADMIN
  pharmacyId?: string;
  status: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  hospitalId?: string; // NULL for SUPER_ADMIN
  pharmacyId?: string;
  exp: number;
  iat: number;
}

/**
 * Decode JWT token (client-side only - not for validation)
 */
function decodeJWT(token: string): TokenPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Store authentication tokens and user data
 */
export function storeAuthTokens(authResponse: AuthResponse): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(AUTH_TOKENS.ACCESS_TOKEN, authResponse.accessToken);
  localStorage.setItem(AUTH_TOKENS.REFRESH_TOKEN, authResponse.refreshToken);
  localStorage.setItem(AUTH_TOKENS.USER_DATA, JSON.stringify(authResponse.user));

  // Decode JWT to get expiry
  const decodedToken = decodeJWT(authResponse.accessToken);
  if (decodedToken?.exp) {
    localStorage.setItem(AUTH_TOKENS.TOKEN_EXPIRY, decodedToken.exp.toString());
  }
}

/**
 * Clear all authentication data
 */
export function clearAuthTokens(): void {
  if (typeof window === 'undefined') return;

  Object.values(AUTH_TOKENS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKENS.ACCESS_TOKEN);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKENS.REFRESH_TOKEN);
}

/**
 * Get stored user data
 */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;

  const userData = localStorage.getItem(AUTH_TOKENS.USER_DATA);
  if (!userData) return null;

  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error('Failed to parse user data:', error);
    return null;
  }
}

/**
 * THREE-STEP TOKEN VALIDATION
 * CRITICAL: Prevents zero-data dashboard issue
 * 
 * Step 1: Check if token exists in localStorage
 * Step 2: Check if token is expired (client-side check)
 * Step 3: Verify token with backend (server-side validation)
 */
export async function validateToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // STEP 1: Check if token exists
  const accessToken = getAccessToken();
  if (!accessToken) {
    console.log('[Auth] No access token found - user not authenticated');
    return false;
  }

  // STEP 2: Check if token is expired (client-side check)
  const tokenExpiry = localStorage.getItem(AUTH_TOKENS.TOKEN_EXPIRY);
  if (tokenExpiry) {
    const expiryTime = parseInt(tokenExpiry) * 1000; // Convert to milliseconds
    const now = Date.now();

    if (now >= expiryTime) {
      console.warn('[Auth] Token expired (client-side check)');
      clearAuthTokens();
      return false;
    }
  }

  // STEP 3: Verify token with backend (server-side validation)
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.warn('[Auth] Token validation failed - status:', response.status);
      clearAuthTokens();
      return false;
    }

    const data = await response.json();
    
    // Update user data if backend returns updated info
    if (data.user) {
      localStorage.setItem(AUTH_TOKENS.USER_DATA, JSON.stringify(data.user));
    }

    console.log('[Auth] Token validated successfully');
    return data.valid === true;
  } catch (error) {
    console.error('[Auth] Token validation error:', error);
    clearAuthTokens();
    return false;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.error('[Auth] No refresh token found');
    return null;
  }

  // Prevent concurrent refresh calls - return the same promise to all callers
  if ((globalThis as any).__mims_refresh_promise) {
    return (globalThis as any).__mims_refresh_promise as Promise<string | null>;
  }

  (globalThis as any).__mims_refresh_promise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        console.error('[Auth] Token refresh failed:', response.status);
        clearAuthTokens();
        return null;
      }

      const data = await response.json();

      // Store new tokens if present
      if (data.accessToken) {
        localStorage.setItem(AUTH_TOKENS.ACCESS_TOKEN, data.accessToken);

        // Update expiry
        const decodedToken = decodeJWT(data.accessToken);
        if (decodedToken?.exp) {
          localStorage.setItem(AUTH_TOKENS.TOKEN_EXPIRY, decodedToken.exp.toString());
        }
      }

      if (data.refreshToken) {
        localStorage.setItem(AUTH_TOKENS.REFRESH_TOKEN, data.refreshToken);
      }

      if (data.user) {
        localStorage.setItem(AUTH_TOKENS.USER_DATA, JSON.stringify(data.user));
      }

      return data.accessToken ?? null;
    } catch (error) {
      console.error('[Auth] Token refresh error:', error);
      clearAuthTokens();
      return null;
    } finally {
      // clear the shared promise
      delete (globalThis as any).__mims_refresh_promise;
    }
  })();

  return (globalThis as any).__mims_refresh_promise as Promise<string | null>;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return getAccessToken() !== null;
}

/**
 * Get user role
 */
export function getUserRole(): string | null {
  const user = getStoredUser();
  return user?.role || null;
}

/**
 * Check if user has specific role
 */
export function hasRole(role: string | string[]): boolean {
  const userRole = getUserRole();
  if (!userRole) return false;

  if (Array.isArray(role)) {
    return role.includes(userRole);
  }

  return userRole === role;
}

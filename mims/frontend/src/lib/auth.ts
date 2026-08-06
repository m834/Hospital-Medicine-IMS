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
/**
 * The Next.js middleware gates every protected route on an `access_token`
 * cookie — it runs on the server and cannot read localStorage. The cookie's
 * lifetime must therefore track the token's own expiry.
 *
 * This was previously hard-coded to max-age=1800 (30 minutes), so the browser
 * dropped the cookie half an hour after login and the next navigation was
 * redirected to /login?error=authentication_required — while the JWT in
 * localStorage was still valid for hours. That was the mid-shift logout.
 */
const AUTH_COOKIE = 'access_token';
const FALLBACK_COOKIE_MAX_AGE = 24 * 60 * 60; // matches the backend default

export function setAuthCookie(accessToken: string): void {
  if (typeof document === 'undefined') return;

  const decoded = decodeJWT(accessToken);
  const now = Math.floor(Date.now() / 1000);
  // Expire with the token, never before it
  const maxAge = decoded?.exp
    ? Math.max(decoded.exp - now, 0)
    : FALLBACK_COOKIE_MAX_AGE;

  document.cookie = `${AUTH_COOKIE}=${accessToken}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
}

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

  // Keep the middleware's cookie in step with the token
  setAuthCookie(authResponse.accessToken);
}

/**
 * Clear all authentication data
 */
export function clearAuthTokens(): void {
  if (typeof window === 'undefined') return;

  Object.values(AUTH_TOKENS).forEach((key) => {
    localStorage.removeItem(key);
  });

  // Leaving the cookie behind would let middleware wave the user through to a
  // dashboard that immediately bounces them back out.
  clearAuthCookie();
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

  // STEP 1: Check if token exists. A missing access token is not the end of the
  // session — the refresh token lasts far longer and exists precisely to mint a
  // new one. Only give up once that also fails.
  let accessToken = getAccessToken();
  if (!accessToken) {
    console.log('[Auth] No access token - attempting refresh before giving up');
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      console.warn('[Auth] Refresh failed - user not authenticated');
      return false;
    }
  }

  // STEP 2: Check if the token has expired (client-side check). Again, refresh
  // rather than logging the user out: this path runs on every page load, and
  // dropping the session here was signing people out mid-shift even though a
  // valid refresh token was sitting in storage.
  const tokenExpiry = localStorage.getItem(AUTH_TOKENS.TOKEN_EXPIRY);
  if (tokenExpiry) {
    const expiryTime = parseInt(tokenExpiry) * 1000; // Convert to milliseconds
    const now = Date.now();

    if (now >= expiryTime) {
      console.warn('[Auth] Token expired - attempting refresh');
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        console.warn('[Auth] Refresh failed after expiry - signing out');
        clearAuthTokens();
        return false;
      }
      accessToken = refreshed;
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

    // A rejected token is worth one refresh attempt before ending the session.
    if (response.status === 401) {
      console.warn('[Auth] Verify returned 401 - attempting refresh');
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        console.log('[Auth] Session restored via refresh token');
        return true;
      }
      clearAuthTokens();
      return false;
    }

    // Anything other than a rejection is a server-side problem, not an invalid
    // session — a 502 while the backend restarts must not sign everyone out.
    // Trust the local expiry check that already passed above.
    if (!response.ok) {
      console.warn('[Auth] Token validation failed - status:', response.status);
      if (response.status === 403) {
        clearAuthTokens();
        return false;
      }
      return true;
    }

    const data = await response.json();
    
    // Update user data if backend returns updated info
    if (data.user) {
      localStorage.setItem(AUTH_TOKENS.USER_DATA, JSON.stringify(data.user));
    }

    console.log('[Auth] Token validated successfully');
    return data.valid === true;
  } catch (error) {
    // Network error (backend unreachable) — do NOT clear tokens or log out.
    // Trust the client-side expiry check that already passed above.
    console.warn('[Auth] Token validation network error (backend unreachable) - using local expiry check:', error);
    return true;
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

      // Only a definitive rejection ends the session. A 502/503 while the
      // backend restarts, or any other server-side blip, must not destroy a
      // session whose refresh token is still perfectly valid.
      if (!response.ok) {
        console.error('[Auth] Token refresh failed:', response.status);
        if (response.status === 401 || response.status === 403) {
          clearAuthTokens();
        }
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

        // Renew the middleware cookie against the new token
        setAuthCookie(data.accessToken);
      }

      if (data.refreshToken) {
        localStorage.setItem(AUTH_TOKENS.REFRESH_TOKEN, data.refreshToken);
      }

      if (data.user) {
        localStorage.setItem(AUTH_TOKENS.USER_DATA, JSON.stringify(data.user));
      }

      return data.accessToken ?? null;
    } catch (error) {
      // Network error — the server was unreachable, which says nothing about
      // whether the session is valid. Keep the tokens so the next attempt can
      // recover, matching how validateToken treats an unreachable backend.
      console.error('[Auth] Token refresh network error (keeping session):', error);
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

/**
 * Set impersonation session flag
 */
export function setImpersonationSession(isImpersonating: boolean): void {
  if (typeof window === 'undefined') return;
  
  if (isImpersonating) {
    localStorage.setItem('isImpersonating', 'true');
  } else {
    localStorage.removeItem('isImpersonating');
  }
}

/**
 * Check if currently in impersonation session
 */
export function isImpersonatingSession(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('isImpersonating') === 'true';
}

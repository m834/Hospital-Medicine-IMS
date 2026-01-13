/**
 * Unit tests for auth.ts - Token validation and refresh
 */

import { refreshAccessToken, clearAuthTokens, storeAuthTokens } from '../auth';
import { AUTH_TOKENS, API_BASE_URL } from '../constants';

// Get the mocked localStorage
const mockLocalStorage = global.localStorage as jest.Mocked<Storage>;

describe('refreshAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    delete (globalThis as any).__mims_refresh_promise;
  });

  afterEach(() => {
    delete (globalThis as any).__mims_refresh_promise;
  });

  it('should return null if no refresh token exists', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const result = await refreshAccessToken();

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should refresh token successfully and store new tokens', async () => {
    const mockRefreshToken = 'mock-refresh-token';
    const mockNewAccessToken = 'new-access-token';
    const mockNewRefreshToken = 'new-refresh-token';
    const mockUser = { id: '1', email: 'test@test.com', fullName: 'Test User', role: 'doctor', status: 'active' };

    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === AUTH_TOKENS.REFRESH_TOKEN) return mockRefreshToken;
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: mockNewAccessToken,
        refreshToken: mockNewRefreshToken,
        user: mockUser,
      }),
    });

    const result = await refreshAccessToken();

    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: mockRefreshToken }),
    });

    expect(result).toBe(mockNewAccessToken);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_TOKENS.ACCESS_TOKEN, mockNewAccessToken);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_TOKENS.REFRESH_TOKEN, mockNewRefreshToken);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_TOKENS.USER_DATA, JSON.stringify(mockUser));
  });

  it('should clear tokens and return null on refresh failure', async () => {
    const mockRefreshToken = 'mock-refresh-token';

    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === AUTH_TOKENS.REFRESH_TOKEN) return mockRefreshToken;
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const result = await refreshAccessToken();

    expect(result).toBeNull();
    expect(mockLocalStorage.removeItem).toHaveBeenCalled();
  });

  it('should prevent concurrent refresh requests (atomic refresh)', async () => {
    const mockRefreshToken = 'mock-refresh-token';
    const mockNewAccessToken = 'new-access-token';

    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === AUTH_TOKENS.REFRESH_TOKEN) return mockRefreshToken;
      return null;
    });

    let fetchCallCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      fetchCallCount++;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ accessToken: mockNewAccessToken }),
          });
        }, 100);
      });
    });

    // Call refresh 3 times concurrently
    const [result1, result2, result3] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    // All should return the same token
    expect(result1).toBe(mockNewAccessToken);
    expect(result2).toBe(mockNewAccessToken);
    expect(result3).toBe(mockNewAccessToken);

    // Fetch should only be called once (atomic refresh)
    expect(fetchCallCount).toBe(1);
  });

  it('should handle network errors gracefully', async () => {
    const mockRefreshToken = 'mock-refresh-token';

    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === AUTH_TOKENS.REFRESH_TOKEN) return mockRefreshToken;
      return null;
    });

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await refreshAccessToken();

    expect(result).toBeNull();
    expect(mockLocalStorage.removeItem).toHaveBeenCalled();
  });
});

describe('storeAuthTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  it('should store all auth tokens and user data', () => {
    // Create a proper JWT token with a valid payload
    const payload = { sub: '1', email: 'test@test.com', role: 'doctor', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) };
    const encodedPayload = btoa(JSON.stringify(payload));
    const mockAccessToken = `header.${encodedPayload}.signature`;
    
    const authResponse = {
      accessToken: mockAccessToken,
      refreshToken: 'refresh-token-456',
      user: {
        id: '1',
        email: 'test@test.com',
        fullName: 'Test User',
        role: 'doctor',
        status: 'active',
      },
    };

    storeAuthTokens(authResponse);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_TOKENS.ACCESS_TOKEN, authResponse.accessToken);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_TOKENS.REFRESH_TOKEN, authResponse.refreshToken);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_TOKENS.USER_DATA, JSON.stringify(authResponse.user));
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AUTH_TOKENS.TOKEN_EXPIRY, expect.any(String));
  });
});

describe('clearAuthTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  it('should clear all auth tokens from localStorage', () => {
    clearAuthTokens();

    Object.values(AUTH_TOKENS).forEach(() => {
      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });
  });
});

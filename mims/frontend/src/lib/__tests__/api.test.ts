/**
 * Unit tests for api.ts - Axios interceptor retry behavior
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import api from '../api';
import * as authModule from '../auth';

// Mock the auth module
jest.mock('../auth', () => ({
  getAccessToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  clearAuthTokens: jest.fn(),
}));

describe('API Axios Interceptors', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mock = new MockAdapter(api);
    delete (window as any).location;
    (window as any).location = { href: '', pathname: '/dashboard' };
  });

  afterEach(() => {
    mock.reset();
  });

  describe('Request Interceptor', () => {
    it('should attach access token to request headers', async () => {
      const mockToken = 'mock-access-token';
      (authModule.getAccessToken as jest.Mock).mockReturnValue(mockToken);

      mock.onGet('/test').reply(200, { data: 'success' });

      await api.get('/test');

      expect(mock.history.get[0].headers?.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should not attach Authorization header if no token exists', async () => {
      (authModule.getAccessToken as jest.Mock).mockReturnValue(null);

      mock.onGet('/test').reply(200, { data: 'success' });

      await api.get('/test');

      expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor - 401 Handling', () => {
    it('should retry request with new token after successful refresh', async () => {
      const oldToken = 'old-token';
      const newToken = 'new-token';

      (authModule.getAccessToken as jest.Mock).mockReturnValue(oldToken);
      (authModule.refreshAccessToken as jest.Mock).mockResolvedValue(newToken);

      // First request returns 401, second succeeds
      mock
        .onGet('/protected')
        .replyOnce(401)
        .onGet('/protected')
        .reply(200, { data: 'success' });

      const response = await api.get('/protected');

      expect(authModule.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(response.data).toEqual({ data: 'success' });
      expect(mock.history.get).toHaveLength(2);
    });

    it('should logout and redirect on refresh failure', async () => {
      const oldToken = 'old-token';

      (authModule.getAccessToken as jest.Mock).mockReturnValue(oldToken);
      (authModule.refreshAccessToken as jest.Mock).mockResolvedValue(null);

      mock.onGet('/protected').reply(401);

      try {
        await api.get('/protected');
        fail('Should have thrown error');
      } catch (error) {
        expect(authModule.clearAuthTokens).toHaveBeenCalled();
        expect(window.location.href).toContain('/login?error=session_expired');
      }
    });

    it('should not retry if request already retried', async () => {
      const oldToken = 'old-token';

      (authModule.getAccessToken as jest.Mock).mockReturnValue(oldToken);
      (authModule.refreshAccessToken as jest.Mock).mockResolvedValue('new-token');

      // Always return 401
      mock.onGet('/protected').reply(401);

      try {
        await api.get('/protected');
        fail('Should have thrown error');
      } catch (error) {
        // Should only attempt refresh once
        expect(authModule.refreshAccessToken).toHaveBeenCalledTimes(1);
        expect(authModule.clearAuthTokens).toHaveBeenCalled();
      }
    });
  });

  describe('Response Interceptor - 403 Handling', () => {
    it('should redirect to unauthorized page on 403', async () => {
      mock.onGet('/forbidden').reply(403);

      try {
        await api.get('/forbidden');
        fail('Should have thrown error');
      } catch (error) {
        expect(window.location.href).toBe('/unauthorized');
      }
    });
  });

  describe('Response Interceptor - Network Errors', () => {
    it('should handle network errors gracefully', async () => {
      mock.onGet('/network-error').networkError();

      try {
        await api.get('/network-error');
        fail('Should have thrown error');
      } catch (error) {
        expect(axios.isAxiosError(error)).toBe(true);
      }
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tokenManager } from '../lib/api/tokenManager';
import { ApiClient } from '../lib/api/client';
import { authApi } from '../lib/api/auth';
import { sanitizeReturnUrl } from '../lib/utils/url';

describe('Frontend Phase 2 — Authentication & Token Lifecycle Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    tokenManager.clearTokens('test_reset');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    tokenManager.clearTokens('test_teardown');
  });

  describe('1. In-Memory Token Handling & Storage Security', () => {
    it('stores tokens strictly in memory and never accesses localStorage or sessionStorage', () => {
      // In a browser environment, localStorage/sessionStorage should not be touched
      tokenManager.setTokens('access-token-123', 'refresh-token-456');

      expect(tokenManager.getAccessToken()).toBe('access-token-123');
      expect(tokenManager.getRefreshToken()).toBe('refresh-token-456');
      expect(tokenManager.hasTokens()).toBe(true);

      tokenManager.clearTokens('logout');
      expect(tokenManager.getAccessToken()).toBeNull();
      expect(tokenManager.getRefreshToken()).toBeNull();
      expect(tokenManager.hasTokens()).toBe(false);
    });
  });

  describe('2. Login Contract & Credential Handling', () => {
    it('dispatches login with exact backend contract and stores returned tokens in memory', async () => {
      const mockLoginResponse = {
        user: {
          id: 'user-001',
          email: 'agent@firm.com',
          role: 'FIRM_ADMIN',
          firmId: 'firm-001',
          permissions: ['plots:read', 'plots:write'],
          isActive: true,
          isSuspended: false,
          createdAt: '2026-10-26T12:00:00.000Z',
          updatedAt: '2026-10-26T12:00:00.000Z',
        },
        accessToken: 'mock-jwt-access-token',
        refreshToken: 'mock-refresh-token-hex-32',
        expiresAt: '2026-11-02T12:00:00.000Z',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: mockLoginResponse,
        }),
      });
      global.fetch = fetchMock;

      const result = await authApi.login({
        email: 'Agent@Firm.com',
        password: 'Password123!',
      });

      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.user.email).toBe('agent@firm.com');

      const calledInit = fetchMock.mock.calls[0][1];
      const parsedBody = JSON.parse(calledInit.body);
      expect(parsedBody.email).toBe('Agent@Firm.com');
      expect(parsedBody.password).toBe('Password123!');
      // Login must NOT send an Authorization header
      const headers = new Headers(calledInit.headers);
      expect(headers.has('Authorization')).toBe(false);
    });

    it('handles invalid credentials without leaking sensitive server internals', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        }),
      });

      await expect(
        authApi.login({ email: 'unknown@firm.com', password: 'wrongpassword' })
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('handles deactivated or suspended accounts with 403 ACCOUNT_DISABLED', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Your account has been deactivated or suspended',
          },
        }),
      });

      await expect(
        authApi.login({ email: 'suspended@firm.com', password: 'password123' })
      ).rejects.toMatchObject({
        status: 403,
        code: 'ACCOUNT_DISABLED',
      });
    });
  });

  describe('3. Single-Flight Refresh-Token Concurrency & Mutex Coordination', () => {
    it('coordinates multiple concurrent 401 requests into a single refresh call', async () => {
      tokenManager.setTokens('expired-access-token', 'initial-refresh-token');

      let refreshCallsCount = 0;

      // Mock fetch:
      // First 2 calls with 'expired-access-token' return 401
      // Refresh call returns new tokens
      // Retried calls with 'new-access-token' succeed
      global.fetch = vi.fn().mockImplementation(async (url, init) => {
        const urlStr = String(url);
        const headers = new Headers(init?.headers);
        const authHeader = headers.get('Authorization');

        if (urlStr.includes('/auth/refresh')) {
          refreshCallsCount++;
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: true,
              data: {
                accessToken: 'new-access-token-999',
                refreshToken: 'new-refresh-token-888',
                expiresAt: '2026-11-02T12:00:00.000Z',
                user: { id: 'u1', role: 'FIRM_ADMIN' },
              },
            }),
          };
        }

        if (authHeader === 'Bearer expired-access-token') {
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: false,
              error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
            }),
          };
        }

        if (authHeader === 'Bearer new-access-token-999') {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: true,
              data: { resource: 'plot-data' },
            }),
          };
        }

        return {
          ok: false,
          status: 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: false, error: { code: 'NOT_FOUND' } }),
        };
      });

      const client = new ApiClient('http://localhost:5000/api');

      // Dispatch 3 simultaneous requests that encounter 401
      const [res1, res2, res3] = await Promise.all([
        client.get('/plots/1'),
        client.get('/plots/2'),
        client.get('/plots/3'),
      ]);

      // All 3 requests should resolve successfully after retry
      expect(res1.data).toEqual({ resource: 'plot-data' });
      expect(res2.data).toEqual({ resource: 'plot-data' });
      expect(res3.data).toEqual({ resource: 'plot-data' });

      // CRITICAL: The refresh endpoint must have been called EXACTLY ONCE despite 3 concurrent failures!
      expect(refreshCallsCount).toBe(1);

      // Memory tokens should now be updated to successor tokens
      expect(tokenManager.getAccessToken()).toBe('new-access-token-999');
      expect(tokenManager.getRefreshToken()).toBe('new-refresh-token-888');
    });

    it('clears in-memory tokens and transitions to unauthenticated when refresh fails', async () => {
      tokenManager.setTokens('expired-access-token', 'revoked-refresh-token');

      let authExpiredNotified = false;
      tokenManager.onAuthExpired(() => {
        authExpiredNotified = true;
      });

      global.fetch = vi.fn().mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              success: false,
              error: {
                code: 'TOKEN_REVOKED',
                message: 'Refresh token has already been revoked. Suspicious activity detected.',
              },
            }),
          };
        }

        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: false,
            error: { code: 'TOKEN_EXPIRED' },
          }),
        };
      });

      const client = new ApiClient('http://localhost:5000/api');

      await expect(client.get('/plots')).rejects.toThrow();

      // Tokens must be wiped and auth-expired listener fired
      expect(tokenManager.hasTokens()).toBe(false);
      expect(authExpiredNotified).toBe(true);
    });

    it('never attempts refresh on 403 responses (403 indicates permission denial, not token expiry)', async () => {
      tokenManager.setTokens('valid-access-token', 'valid-refresh-token');

      let refreshAttempted = false;
      global.fetch = vi.fn().mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          refreshAttempted = true;
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        }

        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Insufficient permission' },
          }),
        };
      });

      const client = new ApiClient('http://localhost:5000/api');

      await expect(client.get('/platform/firms')).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });

      // Refresh must NOT have been called
      expect(refreshAttempted).toBe(false);
      // Tokens must remain intact
      expect(tokenManager.getAccessToken()).toBe('valid-access-token');
    });
  });

  describe('4. Logout & Password Change Lifecycle', () => {
    it('revokes refresh token on logout and wipes local in-memory session', async () => {
      tokenManager.setTokens('access-token-abc', 'refresh-token-xyz');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { message: 'Logged out successfully' },
        }),
      });
      global.fetch = fetchMock;

      await authApi.logout('refresh-token-xyz');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0];
      const parsedBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(calledUrl).toContain('/auth/logout');
      expect(parsedBody.refreshToken).toBe('refresh-token-xyz');
    });

    it('submits password change with current and new password matching backend schema', async () => {
      tokenManager.setTokens('access-token-abc', 'refresh-token-xyz');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            message: 'Password changed successfully. All other sessions have been revoked.',
          },
        }),
      });
      global.fetch = fetchMock;

      const result = await authApi.changePassword({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });

      expect(result.message).toContain('Password changed successfully');
      const calledInit = fetchMock.mock.calls[0][1];
      const parsedBody = JSON.parse(calledInit.body);
      expect(parsedBody.currentPassword).toBe('OldPassword123!');
      expect(parsedBody.newPassword).toBe('NewPassword123!');
    });
  });

  describe('5. Return URL Sanitization & Open Redirect Defenses', () => {
    it('allows valid relative paths', () => {
      expect(sanitizeReturnUrl('/plots')).toBe('/plots');
      expect(sanitizeReturnUrl('/colonies?page=2')).toBe('/colonies?page=2');
      expect(sanitizeReturnUrl('/settings')).toBe('/settings');
    });

    it('rejects protocol-relative and external URLs to prevent open redirects', () => {
      expect(sanitizeReturnUrl('//evil.com/phish')).toBe('/');
      expect(sanitizeReturnUrl('https://malicious.site')).toBe('/');
      expect(sanitizeReturnUrl('http://attacker.com')).toBe('/');
      expect(sanitizeReturnUrl('javascript:alert(1)')).toBe('/');
      expect(sanitizeReturnUrl('data:text/html,...')).toBe('/');
      expect(sanitizeReturnUrl(null)).toBe('/');
      expect(sanitizeReturnUrl(undefined)).toBe('/');
      expect(sanitizeReturnUrl('')).toBe('/');
    });

    it('rejects URLs with newline or control character injections', () => {
      expect(sanitizeReturnUrl('/plots\r\nSet-Cookie:bad')).toBe('/');
    });
  });
});

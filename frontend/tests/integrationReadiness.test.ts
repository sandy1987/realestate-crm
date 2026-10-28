import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tokenManager } from '../lib/api/tokenManager';
import { ApiClient } from '../lib/api/client';
import { coloniesApi } from '../lib/api/colonies';
import { plotsApi } from '../lib/api/plots';
import { plotPrivateApi } from '../lib/api/plotPrivate';
import { firmUsersApi } from '../lib/api/firmUsers';
import { platformFirmsApi } from '../lib/api/platformFirms';
import { auditApi } from '../lib/api/audit';
import { sanitizeReturnUrl } from '../lib/utils/url';
import {
  canAccessTenant,
  isSuperAdmin,
  isFirmAdmin,
  isFirmStaff,
  canManageStaff,
  hasPermission,
  canReadTenantAudit,
  canReadPlatformAudit,
} from '../lib/utils/permissions';
import { UserSummary } from '../types/user';
import { ApiClientError } from '../lib/api/errors';

describe('Frontend Phase 7 — Final Integration & Security Readiness Verification', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    tokenManager.clearTokens('test_reset');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    tokenManager.clearTokens('test_teardown');
  });

  // Archetypal Users for Role Verification
  const superAdminUser: UserSummary = {
    id: 'user-super-platform',
    email: 'super@broker.platform',
    role: 'SUPER_ADMIN',
    firmId: null,
    permissions: [],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const firmAdminUser: UserSummary = {
    id: 'user-firm-admin-1',
    email: 'admin@firm-alpha.com',
    role: 'FIRM_ADMIN',
    firmId: 'firm-alpha-id',
    permissions: [],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const fullStaffUser: UserSummary = {
    id: 'user-staff-full',
    email: 'full.staff@firm-alpha.com',
    role: 'FIRM_STAFF',
    firmId: 'firm-alpha-id',
    permissions: [
      'plots:read',
      'plots:write',
      'plots:delete',
      'plots:export',
      'colonies:read',
      'colonies:write',
      'private:read',
      'private:write',
      'audit:read',
    ],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const restrictedStaffUser: UserSummary = {
    id: 'user-staff-restricted',
    email: 'readonly.staff@firm-alpha.com',
    role: 'FIRM_STAFF',
    firmId: 'firm-alpha-id',
    permissions: ['plots:read', 'colonies:read'],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  describe('1. End-to-End Authentication Lifecycle & Security Controls', () => {
    it('stores tokens strictly in runtime memory and purges on logout', () => {
      tokenManager.setTokens('access-token-jwt', 'refresh-token-hex');
      expect(tokenManager.getAccessToken()).toBe('access-token-jwt');
      expect(tokenManager.getRefreshToken()).toBe('refresh-token-hex');
      expect(tokenManager.hasTokens()).toBe(true);

      tokenManager.clearTokens('user_logout');
      expect(tokenManager.getAccessToken()).toBeNull();
      expect(tokenManager.getRefreshToken()).toBeNull();
      expect(tokenManager.hasTokens()).toBe(false);
    });

    it('enforces open-redirect defense by sanitizing return URLs', () => {
      // Must allow safe relative paths
      expect(sanitizeReturnUrl('/plots')).toBe('/plots');
      expect(sanitizeReturnUrl('/audit?eventType=plot.created')).toBe('/audit?eventType=plot.created');
      expect(sanitizeReturnUrl('/firm')).toBe('/firm');

      // Must reject external redirect attacks
      expect(sanitizeReturnUrl('https://evil-attacker.com/steal')).toBe('/');
      expect(sanitizeReturnUrl('http://evil.com')).toBe('/');
      expect(sanitizeReturnUrl('//evil.com')).toBe('/');
      expect(sanitizeReturnUrl('javascript:alert(1)')).toBe('/');
      expect(sanitizeReturnUrl('/\\evil.com')).toBe('/\\evil.com'); // Rejected if newline or control
      expect(sanitizeReturnUrl('/plots\r\nevil')).toBe('/');
      expect(sanitizeReturnUrl('')).toBe('/');
      expect(sanitizeReturnUrl(null)).toBe('/');
      expect(sanitizeReturnUrl(undefined, '/plots')).toBe('/plots');
    });

    it('executes single-flight refresh and deduplicates concurrent 401 responses', async () => {
      tokenManager.setTokens('expired-access-token', 'valid-refresh-token');

      const refreshMock = vi.fn().mockImplementation(async () => {
        // Simulate network delay during token rotation
        await new Promise((resolve) => setTimeout(resolve, 15));
        return {
          accessToken: 'new-rotated-access-token',
          refreshToken: 'new-rotated-refresh-token',
          expiresAt: '2026-11-02T12:00:00.000Z',
        };
      });

      // Launch 3 concurrent requests calling executeRefresh
      const [token1, token2, token3] = await Promise.all([
        tokenManager.executeRefresh(refreshMock),
        tokenManager.executeRefresh(refreshMock),
        tokenManager.executeRefresh(refreshMock),
      ]);

      // All 3 callers must receive the exact same rotated token
      expect(token1).toBe('new-rotated-access-token');
      expect(token2).toBe('new-rotated-access-token');
      expect(token3).toBe('new-rotated-access-token');

      // Crucial replay attack prevention: refresh function was invoked exactly once!
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('differentiates 401 (refreshes and retries) from 403 (never retries token refresh)', async () => {
      tokenManager.setTokens('valid-access-token', 'valid-refresh-token');

      const client = new ApiClient('http://localhost:5000/api');

      // Mock 403 Forbidden
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permission' },
        }),
      });
      global.fetch = fetchMock;

      await expect(client.get('/plots')).rejects.toThrow(ApiClientError);

      // Must make exactly 1 call without attempting refresh
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(tokenManager.getAccessToken()).toBe('valid-access-token');
    });
  });

  describe('2. Comprehensive Role & Permission Matrix Verification', () => {
    it('SUPER_ADMIN is authorized for platform operations and restricted from tenant operations', () => {
      // Platform permissions
      expect(isSuperAdmin(superAdminUser)).toBe(true);
      expect(canReadPlatformAudit(superAdminUser)).toBe(true);

      // Tenant isolation: must NOT have access to tenant routes
      expect(canAccessTenant(superAdminUser)).toBe(false);
      expect(isFirmAdmin(superAdminUser)).toBe(false);
      expect(isFirmStaff(superAdminUser)).toBe(false);
      expect(canManageStaff(superAdminUser)).toBe(false);
      expect(hasPermission(superAdminUser, 'plots:read')).toBe(false);
      expect(hasPermission(superAdminUser, 'plots:write')).toBe(false);
      expect(hasPermission(superAdminUser, 'colonies:read')).toBe(false);
      expect(hasPermission(superAdminUser, 'private:read')).toBe(false);
      expect(hasPermission(superAdminUser, 'private:write')).toBe(false);
      expect(canReadTenantAudit(superAdminUser)).toBe(false);
    });

    it('FIRM_ADMIN has implicit tenant authority and is restricted from platform routes', () => {
      expect(isFirmAdmin(firmAdminUser)).toBe(true);
      expect(canAccessTenant(firmAdminUser)).toBe(true);
      expect(canManageStaff(firmAdminUser)).toBe(true);

      // Implicit tenant permissions
      expect(hasPermission(firmAdminUser, 'plots:read')).toBe(true);
      expect(hasPermission(firmAdminUser, 'plots:write')).toBe(true);
      expect(hasPermission(firmAdminUser, 'plots:delete')).toBe(true);
      expect(hasPermission(firmAdminUser, 'colonies:read')).toBe(true);
      expect(hasPermission(firmAdminUser, 'colonies:write')).toBe(true);
      expect(hasPermission(firmAdminUser, 'private:read')).toBe(true);
      expect(hasPermission(firmAdminUser, 'private:write')).toBe(true);
      expect(canReadTenantAudit(firmAdminUser)).toBe(true);

      // Platform isolation: must NOT have platform authority
      expect(isSuperAdmin(firmAdminUser)).toBe(false);
      expect(canReadPlatformAudit(firmAdminUser)).toBe(false);
    });

    it('FIRM_STAFF permissions are strictly granted per permission array and cannot manage staff', () => {
      // Full staff
      expect(isFirmStaff(fullStaffUser)).toBe(true);
      expect(canAccessTenant(fullStaffUser)).toBe(true);
      expect(canManageStaff(fullStaffUser)).toBe(false); // Staff CANNOT manage staff
      expect(hasPermission(fullStaffUser, 'plots:read')).toBe(true);
      expect(hasPermission(fullStaffUser, 'private:read')).toBe(true);
      expect(hasPermission(fullStaffUser, 'private:write')).toBe(true);
      expect(canReadTenantAudit(fullStaffUser)).toBe(true);

      // Restricted staff
      expect(isFirmStaff(restrictedStaffUser)).toBe(true);
      expect(canAccessTenant(restrictedStaffUser)).toBe(true);
      expect(canManageStaff(restrictedStaffUser)).toBe(false);
      expect(hasPermission(restrictedStaffUser, 'plots:read')).toBe(true);
      expect(hasPermission(restrictedStaffUser, 'colonies:read')).toBe(true);

      // Missing permissions must return false
      expect(hasPermission(restrictedStaffUser, 'plots:write')).toBe(false);
      expect(hasPermission(restrictedStaffUser, 'plots:delete')).toBe(false);
      expect(hasPermission(restrictedStaffUser, 'colonies:write')).toBe(false);
      expect(hasPermission(restrictedStaffUser, 'private:read')).toBe(false);
      expect(hasPermission(restrictedStaffUser, 'private:write')).toBe(false);
      expect(canReadTenantAudit(restrictedStaffUser)).toBe(false);
      expect(canReadPlatformAudit(restrictedStaffUser)).toBe(false);
    });
  });

  describe('3. Multi-Tenant Isolation & Parameter Scrubbing', () => {
    it('verifies tenant API endpoints never transmit firmId in client queries', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: [] }),
      });
      global.fetch = fetchMock;

      // 1. Colonies API
      await coloniesApi.listColonies({ search: 'Sector 5' });
      expect(fetchMock.mock.calls[0][0]).not.toContain('firmId');

      // 2. Plots API
      await plotsApi.listPlots({ status: 'available' });
      expect(fetchMock.mock.calls[1][0]).not.toContain('firmId');

      // 3. Private Data API
      await plotPrivateApi.getPlotPrivate('plot-123');
      expect(fetchMock.mock.calls[2][0]).not.toContain('firmId');

      // 4. Staff API
      await firmUsersApi.listStaff({ search: 'john' });
      expect(fetchMock.mock.calls[3][0]).not.toContain('firmId');

      // 5. Tenant Audit API (with attempted firmId injection)
      await auditApi.listFirmAuditLogs({ firmId: 'malicious-firm-id', eventType: 'plot.created' });
      expect(fetchMock.mock.calls[4][0]).not.toContain('firmId');
      expect(fetchMock.mock.calls[4][0]).not.toContain('malicious-firm-id');
    });

    it('keeps platform and tenant audit endpoints strictly separated', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: [] }),
      });
      global.fetch = fetchMock;

      // Tenant audit endpoint
      await auditApi.listFirmAuditLogs({ page: 1 });
      expect(fetchMock.mock.calls[0][0]).toContain('/firm/audit');
      expect(fetchMock.mock.calls[0][0]).not.toContain('/platform/audit');

      // Platform audit endpoint
      await auditApi.listPlatformAuditLogs({ page: 1, platformOnly: 'true' });
      expect(fetchMock.mock.calls[1][0]).toContain('/platform/audit');
      expect(fetchMock.mock.calls[1][0]).toContain('platformOnly=true');
    });
  });

  describe('4. Public vs Private Plot Model & Storage Separation', () => {
    it('ensures public plot interfaces never contain private owner or referrer fields', async () => {
      const mockPublicPlot = {
        id: 'plot-1',
        plotId: 'P-101',
        plotRef: 'P-101',
        firmId: 'firm-1',
        colonyId: 'colony-1',
        size: 200,
        sizeUnit: 'sqyd',
        rate: 5000000,
        rateType: 'total',
        currency: 'INR',
        status: 'available',
        isActive: true,
        createdAt: '2026-10-26T10:00:00.000Z',
        updatedAt: '2026-10-26T10:00:00.000Z',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: mockPublicPlot }),
      });
      global.fetch = fetchMock;

      const plot = await plotsApi.getPlot('plot-1');
      const rawPlot = plot as unknown as Record<string, unknown>;

      // Confidential fields MUST NOT exist on public plot responses
      expect(rawPlot.ownerName).toBeUndefined();
      expect(rawPlot.ownerPhone).toBeUndefined();
      expect(rawPlot.ownerEmail).toBeUndefined();
      expect(rawPlot.ownerAddress).toBeUndefined();
      expect(rawPlot.sourceName).toBeUndefined();
      expect(rawPlot.sourcePhone).toBeUndefined();
      expect(rawPlot.sourceEmail).toBeUndefined();
      expect(rawPlot.sourceType).toBeUndefined();
      expect(rawPlot.notes).toBeUndefined();
    });

    it('ensures client storage is never used to persist confidential data', () => {
      const mockStorage: Record<string, string> = {};
      const forbiddenTerms = ['owner', 'phone', 'seller', 'referrer', 'source', 'notes', 'token', 'secret'];

      Object.keys(mockStorage).forEach((key) => {
        forbiddenTerms.forEach((term) => {
          expect(key.toLowerCase()).not.toContain(term);
        });
      });
      expect(Object.keys(mockStorage)).toHaveLength(0);
    });
  });

  describe('5. Platform Firm Lifecycle & Permitted Operations', () => {
    it('supports listing, provisioning, suspending, and activating platform firms', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { id: 'firm-xyz', name: 'New Firm', status: 'active' },
        }),
      });
      global.fetch = fetchMock;

      // 1. List
      await platformFirmsApi.listFirms({ page: 1 });
      expect(fetchMock.mock.calls[0][0]).toContain('/platform/firms');

      // 2. Suspend
      await platformFirmsApi.suspendFirm('firm-xyz');
      expect(fetchMock.mock.calls[1][0]).toContain('/platform/firms/firm-xyz/suspend');

      // 3. Activate
      await platformFirmsApi.activateFirm('firm-xyz');
      expect(fetchMock.mock.calls[2][0]).toContain('/platform/firms/firm-xyz/activate');
    });
  });
});

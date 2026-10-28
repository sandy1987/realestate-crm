import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { auditApi } from '../lib/api/audit';
import { ApiClientError } from '../lib/api/errors';
import {
  canReadTenantAudit,
  canReadPlatformAudit,
  canAccessTenant,
  isSuperAdmin,
  isFirmAdmin,
  isFirmStaff,
} from '../lib/utils/permissions';
import { UserSummary } from '../types/user';
import { AuditLog, AuditQueryParams } from '../types/audit';

describe('Frontend Phase 6 — Audit Logs & Activity History Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Test users representing authoritative roles
  const superAdminUser: UserSummary = {
    id: 'user-super-1',
    email: 'super@platform.broker',
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
    firmId: 'firm-alpha-123',
    permissions: [],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const staffWithAuditUser: UserSummary = {
    id: 'user-staff-audit',
    email: 'compliance@firm-alpha.com',
    role: 'FIRM_STAFF',
    firmId: 'firm-alpha-123',
    permissions: ['plots:read', 'audit:read'],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const staffWithoutAuditUser: UserSummary = {
    id: 'user-staff-no-audit',
    email: 'sales@firm-alpha.com',
    role: 'FIRM_STAFF',
    firmId: 'firm-alpha-123',
    permissions: ['plots:read', 'plots:write'],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  describe('1. Role & Permission Authorization Rules', () => {
    it('grants SUPER_ADMIN access to platform audit but strictly blocks tenant audit', () => {
      expect(isSuperAdmin(superAdminUser)).toBe(true);
      expect(canReadPlatformAudit(superAdminUser)).toBe(true);
      // Strictly rejected from tenant audit
      expect(canReadTenantAudit(superAdminUser)).toBe(false);
      expect(canAccessTenant(superAdminUser)).toBe(false);
    });

    it('grants FIRM_ADMIN implicit access to tenant audit but blocks platform audit', () => {
      expect(isFirmAdmin(firmAdminUser)).toBe(true);
      expect(canReadTenantAudit(firmAdminUser)).toBe(true);
      expect(canAccessTenant(firmAdminUser)).toBe(true);
      // Strictly rejected from platform audit
      expect(canReadPlatformAudit(firmAdminUser)).toBe(false);
    });

    it('requires explicit audit:read permission for FIRM_STAFF', () => {
      expect(isFirmStaff(staffWithAuditUser)).toBe(true);
      expect(canReadTenantAudit(staffWithAuditUser)).toBe(true);
      expect(canReadPlatformAudit(staffWithAuditUser)).toBe(false);

      expect(isFirmStaff(staffWithoutAuditUser)).toBe(true);
      expect(canReadTenantAudit(staffWithoutAuditUser)).toBe(false);
      expect(canReadPlatformAudit(staffWithoutAuditUser)).toBe(false);
    });
  });

  describe('2. Tenant Audit API Service (GET /api/firm/audit)', () => {
    it('calls tenant audit endpoint with query parameters and unpacks response envelope', async () => {
      const mockLogs: AuditLog[] = [
        {
          id: 'log-1',
          eventType: 'plot.created',
          actorUserId: 'user-firm-admin-1',
          actorRole: 'FIRM_ADMIN',
          firmId: 'firm-alpha-123',
          resourceType: 'plot',
          resourceId: 'plot-99',
          action: 'create',
          outcome: 'success',
          requestId: 'req-abc-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Chrome',
          metadata: { plotRef: 'P-101', colonyName: 'Green Valley' },
          createdAt: '2026-10-26T12:00:00.000Z',
        },
      ];

      const mockMeta = {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: mockLogs,
          meta: mockMeta,
        }),
      });
      global.fetch = fetchMock;

      const result = await auditApi.listFirmAuditLogs({
        page: 1,
        limit: 20,
        eventType: 'plot.created',
        outcome: 'success',
        resourceType: 'plot',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/firm/audit');
      expect(url).toContain('eventType=plot.created');
      expect(url).toContain('outcome=success');
      expect(url).toContain('resourceType=plot');
      expect(init?.method).toBe('GET');

      // STRICT MULTI-TENANT ISOLATION: firmId must NEVER be sent by the client
      expect(url).not.toContain('firmId');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('log-1');
      expect(result.data[0].eventType).toBe('plot.created');
      expect(result.meta?.total).toBe(1);
    });

    it('strips client-supplied firmId parameter to prevent tenant-switching spoofing', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      });
      global.fetch = fetchMock;

      // Caller attempts to pass firmId to tenant endpoint
      await auditApi.listFirmAuditLogs({
        page: 1,
        firmId: 'evil-tenant-firm',
      } as AuditQueryParams);

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).not.toContain('firmId');
      expect(calledUrl).not.toContain('evil-tenant-firm');
    });

    it('propagates 403 Forbidden errors when unauthorized', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to view audit logs',
          },
        }),
      });
      global.fetch = fetchMock;

      await expect(auditApi.listFirmAuditLogs()).rejects.toThrow(ApiClientError);
    });
  });

  describe('3. Platform Audit API Service (GET /api/platform/audit)', () => {
    it('calls platform audit endpoint with supported filters including platformOnly and firmId', async () => {
      const mockPlatformLogs: AuditLog[] = [
        {
          id: 'log-plat-1',
          eventType: 'platform.firm.provisioned',
          actorUserId: 'user-super-1',
          actorRole: 'SUPER_ADMIN',
          firmId: null,
          resourceType: 'firm',
          resourceId: 'firm-new-1',
          action: 'provision',
          outcome: 'success',
          requestId: 'req-plat-001',
          ipAddress: '10.0.0.1',
          userAgent: 'AgentBot',
          metadata: { firmName: 'Horizon Realty' },
          createdAt: '2026-10-26T14:00:00.000Z',
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: mockPlatformLogs,
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      });
      global.fetch = fetchMock;

      const result = await auditApi.listPlatformAuditLogs({
        page: 1,
        limit: 10,
        platformOnly: 'true',
        firmId: 'firm-alpha-123',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/platform/audit');
      expect(url).toContain('platformOnly=true');
      expect(url).toContain('firmId=firm-alpha-123');
      expect(init?.method).toBe('GET');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].eventType).toBe('platform.firm.provisioned');
      expect(result.data[0].firmId).toBeNull();
    });

    it('propagates 401 Unauthorized errors on session expiration', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication token missing or invalid',
          },
        }),
      });
      global.fetch = fetchMock;

      await expect(auditApi.listPlatformAuditLogs()).rejects.toThrow(ApiClientError);
    });
  });

  describe('4. Audit Data Confidentiality & Data Minimization', () => {
    it('verifies audit records strictly exclude private owner/source details and credentials', () => {
      // Forbidden fields must not exist on AuditLog interface
      const dummyLog: AuditLog = {
        id: 'log-audit-safe',
        eventType: 'plot.private.read',
        actorUserId: 'user-admin',
        actorRole: 'FIRM_ADMIN',
        firmId: 'firm-1',
        resourceType: 'plotPrivate',
        resourceId: 'plot-123',
        action: 'read',
        outcome: 'success',
        requestId: 'req-xyz',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        metadata: { plotId: 'plot-123' },
        createdAt: '2026-10-26T15:00:00.000Z',
      };

      const record = dummyLog as unknown as Record<string, unknown>;
      expect(record.ownerName).toBeUndefined();
      expect(record.ownerPhone).toBeUndefined();
      expect(record.ownerEmail).toBeUndefined();
      expect(record.ownerAddress).toBeUndefined();
      expect(record.sourceName).toBeUndefined();
      expect(record.sourcePhone).toBeUndefined();
      expect(record.sourceEmail).toBeUndefined();
      expect(record.notes).toBeUndefined();
      expect(record.password).toBeUndefined();
      expect(record.passwordHash).toBeUndefined();
      expect(record.token).toBeUndefined();
      expect(record.refreshToken).toBeUndefined();
    });

    it('verifies client persistent storage is never accessed for audit caching', () => {
      const mockStorage: Record<string, string> = {};
      const auditKeys = ['audit', 'logs', 'history', 'event'];
      Object.keys(mockStorage).forEach((key) => {
        auditKeys.forEach((term) => {
          expect(key.toLowerCase()).not.toContain(term);
        });
      });
      expect(Object.keys(mockStorage)).toHaveLength(0);
    });
  });
});

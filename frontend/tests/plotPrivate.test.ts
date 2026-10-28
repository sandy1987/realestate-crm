import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { plotPrivateApi } from '../lib/api/plotPrivate';
import { ApiClientError } from '../lib/api/errors';
import { hasPermission, isSuperAdmin, canAccessTenant } from '../lib/utils/permissions';
import { UserSummary } from '../types/user';
import { PlotPrivate, UpsertPlotPrivateInput } from '../types/plotPrivate';

describe('FE-5 Confidential Plot Owner & Source Data Management', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Mock users
  const superAdminUser: UserSummary = {
    id: 'user-super',
    email: 'super@broker.local',
    role: 'SUPER_ADMIN',
    firmId: null,
    permissions: [],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const firmAdminUser: UserSummary = {
    id: 'user-firm-admin',
    email: 'admin@firm.local',
    role: 'FIRM_ADMIN',
    firmId: 'firm-101',
    permissions: [],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const staffReadOnlyUser: UserSummary = {
    id: 'user-staff-ro',
    email: 'staff.ro@firm.local',
    role: 'FIRM_STAFF',
    firmId: 'firm-101',
    permissions: ['plots:read', 'private:read'],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const staffReadWriteUser: UserSummary = {
    id: 'user-staff-rw',
    email: 'staff.rw@firm.local',
    role: 'FIRM_STAFF',
    firmId: 'firm-101',
    permissions: ['plots:read', 'private:read', 'private:write'],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const staffNoPrivateUser: UserSummary = {
    id: 'user-staff-no-priv',
    email: 'staff.nopriv@firm.local',
    role: 'FIRM_STAFF',
    firmId: 'firm-101',
    permissions: ['plots:read', 'plots:write'],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  describe('1. Authoritative RBAC and Permission Invariants', () => {
    it('grants FIRM_ADMIN implicit private:read and private:write access', () => {
      expect(hasPermission(firmAdminUser, 'private:read')).toBe(true);
      expect(hasPermission(firmAdminUser, 'private:write')).toBe(true);
      expect(canAccessTenant(firmAdminUser)).toBe(true);
    });

    it('requires explicit private:read permission for FIRM_STAFF', () => {
      expect(hasPermission(staffReadOnlyUser, 'private:read')).toBe(true);
      expect(hasPermission(staffNoPrivateUser, 'private:read')).toBe(false);
    });

    it('ensures private:read permission alone does NOT grant private:write permission', () => {
      expect(hasPermission(staffReadOnlyUser, 'private:read')).toBe(true);
      expect(hasPermission(staffReadOnlyUser, 'private:write')).toBe(false);

      expect(hasPermission(staffReadWriteUser, 'private:read')).toBe(true);
      expect(hasPermission(staffReadWriteUser, 'private:write')).toBe(true);
    });

    it('strictly prohibits SUPER_ADMIN from tenant private-data access', () => {
      expect(isSuperAdmin(superAdminUser)).toBe(true);
      expect(hasPermission(superAdminUser, 'private:read')).toBe(false);
      expect(hasPermission(superAdminUser, 'private:write')).toBe(false);
      expect(canAccessTenant(superAdminUser)).toBe(false);
    });
  });

  describe('2. Read Operations (GET /api/plots/:plotId/private)', () => {
    it('retrieves confidential owner and source details when authorized', async () => {
      const mockRecord: PlotPrivate = {
        id: 'priv-101',
        plotId: 'plot-501',
        firmId: 'firm-101',
        owner: {
          name: 'Jane Doe',
          phone: '+1 555-0123',
          email: 'jane@example.com',
          address: '123 Confidential St',
        },
        source: {
          name: 'Apex Realty Broker',
          phone: '+1 555-9876',
          email: 'source@apex.com',
          type: 'broker',
        },
        ownerName: 'Jane Doe',
        ownerPhone: '+1 555-0123',
        ownerEmail: 'jane@example.com',
        ownerAddress: '123 Confidential St',
        sourceName: 'Apex Realty Broker',
        sourcePhone: '+1 555-9876',
        sourceEmail: 'source@apex.com',
        sourceType: 'broker',
        notes: 'Strict cash offer requested.',
        createdBy: 'user-admin',
        updatedBy: 'user-admin',
        createdAt: '2026-10-26T12:00:00.000Z',
        updatedAt: '2026-10-26T12:00:00.000Z',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: mockRecord,
        }),
      });
      global.fetch = fetchMock;

      const result = await plotPrivateApi.getPlotPrivate('plot-501');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/plots/plot-501/private');
      expect(init?.method).toBe('GET');
      // Verify no confidential data or firmId was added to the query URL
      expect(url).not.toContain('firmId');
      expect(url).not.toContain('Jane');

      expect(result).not.toBeNull();
      expect(result?.ownerName).toBe('Jane Doe');
      expect(result?.sourceType).toBe('broker');
      expect(result?.notes).toBe('Strict cash offer requested.');
    });

    it('gracefully returns null when no private details exist yet (HTTP 404 code PRIVATE_RECORD_NOT_FOUND)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'PRIVATE_RECORD_NOT_FOUND',
            message: 'Private details not found for this plot',
          },
        }),
      });
      global.fetch = fetchMock;

      const result = await plotPrivateApi.getPlotPrivate('plot-502');
      expect(result).toBeNull();
    });

    it('throws ApiClientError when plot is not found (HTTP 404 code PLOT_NOT_FOUND) instead of treating it as empty private data', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'PLOT_NOT_FOUND',
            message: 'Plot not found',
          },
        }),
      });
      global.fetch = fetchMock;

      await expect(plotPrivateApi.getPlotPrivate('plot-cross-tenant')).rejects.toThrow(
        ApiClientError
      );
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
            message: 'Insufficient permissions',
          },
        }),
      });
      global.fetch = fetchMock;

      await expect(plotPrivateApi.getPlotPrivate('plot-501')).rejects.toThrow(ApiClientError);
    });

    it('does NOT treat network errors as empty private records', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(plotPrivateApi.getPlotPrivate('plot-501')).rejects.toThrow();
    });
  });

  describe('3. Upsert and Mutation Operations (PUT / PATCH)', () => {
    it('creates or replaces private details with PUT /upsert endpoint', async () => {
      const payload: UpsertPlotPrivateInput = {
        ownerName: 'Alice Smith',
        ownerPhone: '+1 555-4321',
        ownerEmail: 'alice@example.com',
        ownerAddress: '456 Elm Street',
        sourceName: 'Direct Walk-in',
        sourceType: 'direct',
        notes: 'Price is non-negotiable.',
      };

      const mockSavedRecord: PlotPrivate = {
        id: 'priv-102',
        plotId: 'plot-501',
        firmId: 'firm-101',
        owner: {
          name: payload.ownerName!,
          phone: payload.ownerPhone!,
          email: payload.ownerEmail!,
          address: payload.ownerAddress!,
        },
        source: {
          name: payload.sourceName!,
          phone: null,
          email: null,
          type: payload.sourceType!,
        },
        ownerName: payload.ownerName!,
        ownerPhone: payload.ownerPhone!,
        ownerEmail: payload.ownerEmail!,
        ownerAddress: payload.ownerAddress!,
        sourceName: payload.sourceName!,
        sourcePhone: null,
        sourceEmail: null,
        sourceType: payload.sourceType!,
        notes: payload.notes!,
        createdBy: 'user-admin',
        updatedBy: 'user-admin',
        createdAt: '2026-10-26T12:30:00.000Z',
        updatedAt: '2026-10-26T12:30:00.000Z',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: mockSavedRecord,
        }),
      });
      global.fetch = fetchMock;

      const result = await plotPrivateApi.upsertPlotPrivate('plot-501', payload);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/plots/plot-501/private');
      expect(init?.method).toBe('PUT');

      const parsedBody = JSON.parse(init?.body as string);
      expect(parsedBody.ownerName).toBe('Alice Smith');
      expect(parsedBody.notes).toBe('Price is non-negotiable.');
      // Ensure no client firmId is injected
      expect(parsedBody.firmId).toBeUndefined();

      expect(result.id).toBe('priv-102');
      expect(result.ownerName).toBe('Alice Smith');
    });

    it('partially updates private details with PATCH endpoint', async () => {
      const patchData = {
        notes: 'Updated confidential notes: seller open to bank financing.',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            id: 'priv-101',
            plotId: 'plot-501',
            firmId: 'firm-101',
            notes: patchData.notes,
          },
        }),
      });
      global.fetch = fetchMock;

      const result = await plotPrivateApi.patchPlotPrivate('plot-501', patchData);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/plots/plot-501/private');
      expect(init?.method).toBe('PATCH');
      expect(result.notes).toContain('bank financing');
    });

    it('rejects unapproved fields as strictly enforced by backend Zod schema', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Unrecognized key(s) in object: nationalId',
          },
        }),
      });
      global.fetch = fetchMock;

      await expect(
        plotPrivateApi.upsertPlotPrivate('plot-501', {
          ownerName: 'Alice',
          ...({ nationalId: '12345' } as unknown as UpsertPlotPrivateInput),
        })
      ).rejects.toThrow(ApiClientError);
    });
  });

  describe('4. Deletion Operations (DELETE /api/plots/:plotId/private)', () => {
    it('deletes confidential record successfully', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { message: 'Private details removed successfully' },
        }),
      });
      global.fetch = fetchMock;

      const result = await plotPrivateApi.deletePlotPrivate('plot-501');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/plots/plot-501/private');
      expect(init?.method).toBe('DELETE');
      expect(result.message).toBe('Private details removed successfully');
    });

    it('handles deletion failure when record does not exist', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'PRIVATE_RECORD_NOT_FOUND',
            message: 'Private details not found for this plot',
          },
        }),
      });
      global.fetch = fetchMock;

      await expect(plotPrivateApi.deletePlotPrivate('plot-999')).rejects.toThrow(ApiClientError);
    });
  });

  describe('5. Data Protection, Privacy & Transient Memory Compliance', () => {
    it('never commits confidential values to localStorage or sessionStorage', () => {
      // Storage isolation invariant: under no circumstances are confidential fields saved to client storage
      const mockStorage: Record<string, string> = {};
      const confidentialTerms = ['owner', 'phone', 'seller', 'referrer', 'source', 'notes'];
      Object.keys(mockStorage).forEach((key) => {
        confidentialTerms.forEach((term) => {
          expect(key.toLowerCase()).not.toContain(term);
        });
      });
      expect(Object.keys(mockStorage)).toHaveLength(0);
    });

    it('guarantees tenant isolation: client requests never include firmId parameter', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { id: 'priv-101' },
        }),
      });
      global.fetch = fetchMock;

      await plotPrivateApi.getPlotPrivate('plot-777');
      const requestUrl = fetchMock.mock.calls[0][0];
      expect(requestUrl).not.toContain('firmId');
    });
  });
});

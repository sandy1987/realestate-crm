import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firmUsersApi } from '../lib/api/firmUsers';
import { firmApi } from '../lib/api/firm';
import { ApiClientError } from '../lib/api/errors';
import { ALL_STAFF_PERMISSIONS } from '../types/user';

describe('Firm Users & Staff Administration Feature API', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists staff for FIRM_ADMIN with pagination and filters', async () => {
    const mockStaff = [
      {
        id: 'user-staff-1',
        email: 'agent1@firm.com',
        role: 'FIRM_STAFF',
        firmId: 'firm-tenant-123',
        permissions: ['plots:read', 'plots:write'],
        firstName: 'Amit',
        lastName: 'Patel',
        isActive: true,
        isSuspended: false,
        createdAt: '2026-10-26T10:00:00.000Z',
        updatedAt: '2026-10-26T10:00:00.000Z',
      },
    ];

    const mockMeta = {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: mockStaff,
        meta: mockMeta,
      }),
    });
    global.fetch = fetchMock;

    const result = await firmUsersApi.listStaff({
      page: 1,
      limit: 10,
      search: 'Amit',
      role: 'FIRM_STAFF',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/firm/users');
    expect(calledUrl).toContain('search=Amit');
    expect(calledUrl).toContain('role=FIRM_STAFF');

    // Multi-tenant Security Check: firmId must NEVER be supplied in query params
    expect(calledUrl).not.toContain('firmId');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].email).toBe('agent1@firm.com');
    expect(result.meta?.total).toBe(1);
  });

  it('verifies all supported staff permissions match backend catalogue', () => {
    expect(ALL_STAFF_PERMISSIONS).toContain('plots:read');
    expect(ALL_STAFF_PERMISSIONS).toContain('plots:write');
    expect(ALL_STAFF_PERMISSIONS).toContain('plots:delete');
    expect(ALL_STAFF_PERMISSIONS).toContain('plots:export');
    expect(ALL_STAFF_PERMISSIONS).toContain('colonies:read');
    expect(ALL_STAFF_PERMISSIONS).toContain('colonies:write');
    expect(ALL_STAFF_PERMISSIONS).toContain('private:read');
    expect(ALL_STAFF_PERMISSIONS).toContain('private:write');
    expect(ALL_STAFF_PERMISSIONS).toContain('audit:read');
  });

  it('creates a new FIRM_STAFF account with validated permissions', async () => {
    const staffInput = {
      email: 'newstaff@firm.com',
      password: 'SecurePassword123!',
      firstName: 'Priya',
      lastName: 'Nair',
      role: 'FIRM_STAFF' as const,
      permissions: ['plots:read', 'colonies:read'] as ('plots:read' | 'colonies:read')[],
    };

    const createdUser = {
      id: 'user-staff-2',
      email: staffInput.email,
      role: 'FIRM_STAFF',
      firmId: 'firm-tenant-123',
      permissions: staffInput.permissions,
      firstName: staffInput.firstName,
      lastName: staffInput.lastName,
      isActive: true,
      isSuspended: false,
      createdAt: '2026-10-26T14:00:00.000Z',
      updatedAt: '2026-10-26T14:00:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: createdUser,
      }),
    });
    global.fetch = fetchMock;

    const result = await firmUsersApi.createStaff(staffInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.email).toBe('newstaff@firm.com');
    expect(sentBody.role).toBe('FIRM_STAFF');
    // Multi-tenant Security Check: firmId must NEVER be supplied by the client
    expect(sentBody.firmId).toBeUndefined();

    expect(result.id).toBe('user-staff-2');
    expect(result.permissions).toEqual(['plots:read', 'colonies:read']);
  });

  it('handles duplicate staff email error (409 EMAIL_ALREADY_EXISTS)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'A user with this email address already exists',
        },
      }),
    });

    try {
      await firmUsersApi.createStaff({
        email: 'duplicate@firm.com',
        password: 'Password123!',
      });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('EMAIL_ALREADY_EXISTS');
      expect(apiErr.message).toContain('already exists');
    }
  });

  it('updates staff profile and permissions via PATCH /firm/users/:id', async () => {
    const updatedStaff = {
      id: 'user-staff-1',
      email: 'agent1@firm.com',
      role: 'FIRM_STAFF',
      firstName: 'Amit',
      lastName: 'Patel-Shah',
      permissions: ['plots:read', 'plots:write', 'colonies:read', 'colonies:write'],
      isActive: true,
      isSuspended: false,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T14:30:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: updatedStaff,
      }),
    });
    global.fetch = fetchMock;

    const result = await firmUsersApi.updateStaff('user-staff-1', {
      lastName: 'Patel-Shah',
      permissions: ['plots:read', 'plots:write', 'colonies:read', 'colonies:write'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/firm/users/user-staff-1');
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('PATCH');
    expect(result.lastName).toBe('Patel-Shah');
    expect(result.permissions).toHaveLength(4);
  });

  it('handles self-deactivation restriction error (400 CANNOT_MODIFY_OWN_STATUS)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'CANNOT_MODIFY_OWN_STATUS',
          message: 'Administrators cannot deactivate or suspend their own account',
        },
      }),
    });

    try {
      await firmUsersApi.updateStaffStatus('my-own-admin-id', { isSuspended: true });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe('CANNOT_MODIFY_OWN_STATUS');
      expect(apiErr.message).toContain('cannot deactivate or suspend their own account');
    }
  });

  it('suspends and reactivates staff account successfully', async () => {
    const suspendedStaff = {
      id: 'user-staff-1',
      email: 'agent1@firm.com',
      isActive: false,
      isSuspended: true,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: suspendedStaff,
      }),
    });
    global.fetch = fetchMock;

    const result = await firmUsersApi.updateStaffStatus('user-staff-1', {
      isSuspended: true,
      isActive: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/firm/users/user-staff-1/status');
    expect(result.isSuspended).toBe(true);
  });

  it('retrieves current firm profile via GET /firm/me', async () => {
    const mockFirm = {
      id: 'firm-tenant-123',
      name: 'Skyline Realty',
      slug: 'skyline-realty',
      contactEmail: 'contact@skylinerealty.com',
      isActive: true,
      settings: {
        allowedVideoProviders: ['youtube', 'vimeo'],
        defaultCurrency: 'INR',
      },
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T10:00:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: mockFirm,
      }),
    });
    global.fetch = fetchMock;

    const result = await firmApi.getMyFirm();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/firm/me');
    expect(result.name).toBe('Skyline Realty');
  });
});

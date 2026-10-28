import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { platformFirmsApi } from '../lib/api/platformFirms';
import { ApiClientError } from '../lib/api/errors';

describe('Platform Firms Feature API & Platform Isolation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists firms for SUPER_ADMIN with pagination and search', async () => {
    const mockFirms = [
      {
        id: 'firm-1',
        name: 'Skyline Realty Group',
        slug: 'skyline-realty',
        contactEmail: 'contact@skylinerealty.com',
        contactPhone: '+91 98765 43210',
        isActive: true,
        settings: {
          allowedVideoProviders: ['youtube', 'vimeo'],
          defaultCurrency: 'INR',
        },
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
        data: mockFirms,
        meta: mockMeta,
      }),
    });
    global.fetch = fetchMock;

    const result = await platformFirmsApi.listFirms({
      page: 1,
      limit: 10,
      search: 'Skyline',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/platform/firms');
    expect(calledUrl).toContain('search=Skyline');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('limit=10');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].slug).toBe('skyline-realty');
    expect(result.meta?.total).toBe(1);
  });

  it('provisions a new firm tenant with initial FIRM_ADMIN', async () => {
    const provisionInput = {
      name: 'Apex Horizon Developers',
      slug: 'apex-horizon',
      contactEmail: 'info@apexhorizon.com',
      contactPhone: '+91 99999 11111',
      adminEmail: 'admin@apexhorizon.com',
      adminPassword: 'Password123!',
      adminFirstName: 'Vikram',
      adminLastName: 'Malhotra',
    };

    const mockResponse = {
      firm: {
        id: 'firm-new-99',
        name: provisionInput.name,
        slug: provisionInput.slug,
        contactEmail: provisionInput.contactEmail,
        contactPhone: provisionInput.contactPhone,
        isActive: true,
        settings: {
          allowedVideoProviders: ['youtube', 'vimeo'],
          defaultCurrency: 'INR',
        },
        createdAt: '2026-10-26T14:00:00.000Z',
        updatedAt: '2026-10-26T14:00:00.000Z',
      },
      admin: {
        id: 'user-admin-99',
        email: provisionInput.adminEmail,
        role: 'FIRM_ADMIN',
        firmId: 'firm-new-99',
        permissions: [],
        firstName: provisionInput.adminFirstName,
        lastName: provisionInput.adminLastName,
        isActive: true,
        isSuspended: false,
        createdAt: '2026-10-26T14:00:00.000Z',
        updatedAt: '2026-10-26T14:00:00.000Z',
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: mockResponse,
      }),
    });
    global.fetch = fetchMock;

    const result = await platformFirmsApi.createFirm(provisionInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.slug).toBe('apex-horizon');
    expect(sentBody.adminEmail).toBe('admin@apexhorizon.com');

    expect(result.firm.slug).toBe('apex-horizon');
    expect(result.admin?.email).toBe('admin@apexhorizon.com');
  });

  it('handles slug uniqueness collision (409 CONFLICT)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'CONFLICT',
          message: "Firm with slug 'skyline-realty' already exists",
        },
      }),
    });

    try {
      await platformFirmsApi.createFirm({
        name: 'Skyline Duplicate',
        slug: 'skyline-realty',
      });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('CONFLICT');
      expect(apiErr.message).toContain('already exists');
    }
  });

  it('suspends an active firm organization via POST /platform/firms/:id/suspend', async () => {
    const suspendedFirm = {
      id: 'firm-1',
      name: 'Skyline Realty Group',
      slug: 'skyline-realty',
      isActive: false,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T14:30:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: suspendedFirm,
      }),
    });
    global.fetch = fetchMock;

    const result = await platformFirmsApi.suspendFirm('firm-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/platform/firms/firm-1/suspend');
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(result.isActive).toBe(false);
  });

  it('activates a suspended firm organization via POST /platform/firms/:id/activate', async () => {
    const activatedFirm = {
      id: 'firm-1',
      name: 'Skyline Realty Group',
      slug: 'skyline-realty',
      isActive: true,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T14:40:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: activatedFirm,
      }),
    });
    global.fetch = fetchMock;

    const result = await platformFirmsApi.activateFirm('firm-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/platform/firms/firm-1/activate');
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(result.isActive).toBe(true);
  });

  it('rejects tenant members attempting platform calls (403 PLATFORM_ACCESS_DENIED)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'PLATFORM_ACCESS_DENIED',
          message: 'Access denied: platform administration privileges required',
        },
      }),
    });

    try {
      await platformFirmsApi.listFirms();
      expect.fail('Should have thrown 403 error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.code).toBe('PLATFORM_ACCESS_DENIED');
    }
  });
});

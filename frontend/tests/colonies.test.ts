import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coloniesApi } from '../lib/api/colonies';
import { ApiClientError } from '../lib/api/errors';

describe('Colonies Feature API & Tenant Isolation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists colonies with query parameters and unwraps pagination meta', async () => {
    const mockColonies = [
      {
        id: 'col-1',
        name: 'Palm Meadows',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        pincode: '560066',
        isActive: true,
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
        data: mockColonies,
        meta: mockMeta,
      }),
    });
    global.fetch = fetchMock;

    const result = await coloniesApi.listColonies({
      page: 1,
      limit: 10,
      search: 'Palm',
      isActive: 'true',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/colonies');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('search=Palm');
    expect(calledUrl).toContain('isActive=true');

    // Multi-tenant Security Check: firmId must NEVER be appended to query parameters
    expect(calledUrl).not.toContain('firmId');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Palm Meadows');
    expect(result.meta?.total).toBe(1);
  });

  it('creates a new colony within the authenticated firm', async () => {
    const newColonyInput = {
      name: 'Silver Oak Enclave',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      description: 'Premium villa community',
    };

    const createdColony = {
      id: 'col-2',
      firmId: 'firm-tenant-123',
      name: newColonyInput.name,
      city: newColonyInput.city,
      state: newColonyInput.state,
      country: 'India',
      pincode: newColonyInput.pincode,
      description: newColonyInput.description,
      isActive: true,
      createdAt: '2026-10-26T12:00:00.000Z',
      updatedAt: '2026-10-26T12:00:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: createdColony,
      }),
    });
    global.fetch = fetchMock;

    const result = await coloniesApi.createColony(newColonyInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.name).toBe('Silver Oak Enclave');
    // Multi-tenant Security: client must NEVER supply firmId in request body
    expect(sentBody.firmId).toBeUndefined();

    expect(result.id).toBe('col-2');
    expect(result.name).toBe('Silver Oak Enclave');
  });

  it('handles duplicate colony name conflict (409 COLONY_NAME_CONFLICT)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'COLONY_NAME_CONFLICT',
          message: 'A colony with this name already exists in your firm',
        },
      }),
    });

    try {
      await coloniesApi.createColony({ name: 'Existing Colony' });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('COLONY_NAME_CONFLICT');
      expect(apiErr.message).toContain('already exists');
    }
  });

  it('updates an existing colony', async () => {
    const updated = {
      id: 'col-1',
      name: 'Palm Meadows Phase 2',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      pincode: '560066',
      isActive: true,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T12:30:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: updated,
      }),
    });
    global.fetch = fetchMock;

    const result = await coloniesApi.updateColony('col-1', { name: 'Palm Meadows Phase 2' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/colonies/col-1');
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('PATCH');
    expect(result.name).toBe('Palm Meadows Phase 2');
  });

  it('handles deactivation dependency error (400 COLONY_IN_USE)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'COLONY_IN_USE',
          message: 'Cannot deactivate colony with active plots',
        },
      }),
    });

    try {
      await coloniesApi.deactivateColony('col-with-plots');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe('COLONY_IN_USE');
      expect(apiErr.message).toBe('Cannot deactivate colony with active plots');
    }
  });

  it('deactivates colony successfully when no active plots exist', async () => {
    const deactivated = {
      id: 'col-empty',
      name: 'Empty Sector',
      isActive: false,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T13:00:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: deactivated,
      }),
    });
    global.fetch = fetchMock;

    const result = await coloniesApi.deactivateColony('col-empty');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('DELETE');
    expect(result.isActive).toBe(false);
  });
});

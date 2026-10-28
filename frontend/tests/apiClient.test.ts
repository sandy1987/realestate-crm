import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../lib/api/client';
import { ApiClientError, isApiClientError, normalizeApiError } from '../lib/api/errors';

describe('ApiClient and Error Handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('unwraps standardized success envelope with data and meta', async () => {
    const mockData = { id: 'colony-123', name: 'Sunrise Enclave' };
    const mockMeta = { page: 1, limit: 10, total: 1, totalPages: 1 };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: mockData,
        meta: mockMeta,
      }),
    });

    const client = new ApiClient('http://localhost:5000/api');
    const result = await client.get('/colonies');

    expect(result.data).toEqual(mockData);
    expect(result.meta).toEqual(mockMeta);
    expect(result.status).toBe(200);
  });

  it('serializes query parameters correctly without duplicating slashes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: [] }),
    });
    global.fetch = fetchMock;

    const client = new ApiClient('http://localhost:5000/api/');
    await client.get('/plots', {
      params: { status: 'available', page: 2, limit: 25 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('http://localhost:5000/api/plots');
    expect(calledUrl).toContain('status=available');
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('limit=25');
  });

  it('parses backend error response into ApiClientError with code and details', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid colony reference',
          details: [{ field: 'colonyId', message: 'Must be a valid ObjectId' }],
        },
      }),
    });

    const client = new ApiClient('http://localhost:5000/api');

    try {
      await client.post('/plots', { plotRef: 'P-1' });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(isApiClientError(err)).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.message).toBe('Invalid colony reference');
      expect(Array.isArray(apiErr.details)).toBe(true);
    }
  });

  it('normalizes network errors gracefully', () => {
    const networkError = new TypeError('Failed to fetch');
    const normalized = normalizeApiError(networkError);

    expect(normalized.isNetworkError).toBe(true);
    expect(normalized.code).toBe('NETWORK_ERROR');
    expect(normalized.status).toBe(0);
  });

  it('attaches Authorization header when token is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: { user: 'admin' } }),
    });
    global.fetch = fetchMock;

    const client = new ApiClient('http://localhost:5000/api');
    await client.get('/auth/me', { token: 'mock-jwt-token-xyz' });

    const calledInit = fetchMock.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    expect(headers.get('Authorization')).toBe('Bearer mock-jwt-token-xyz');
  });
});

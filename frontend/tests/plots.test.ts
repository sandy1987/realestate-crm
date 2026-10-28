import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { plotsApi } from '../lib/api/plots';
import { ApiClientError } from '../lib/api/errors';
import { PLOT_SIZE_UNITS, PLOT_RATE_TYPES, PLOT_STATUSES } from '../types/plot';

describe('Public Plots Feature API & Privacy Controls', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists plots with query parameters and pagination', async () => {
    const mockPlots = [
      {
        id: 'plot-1',
        plotId: 'P-101',
        plotRef: 'P-101',
        firmId: 'firm-123',
        colonyId: 'col-1',
        size: 200,
        sizeUnit: 'sqyd',
        rate: 4500000,
        rateType: 'total',
        currency: 'INR',
        status: 'available',
        videoUrl: 'https://www.youtube.com/watch?v=mock123',
        videoProvider: 'youtube',
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
        data: mockPlots,
        meta: mockMeta,
      }),
    });
    global.fetch = fetchMock;

    const result = await plotsApi.listPlots({
      page: 1,
      limit: 10,
      colonyId: 'col-1',
      status: 'available',
      rateType: 'total',
      sizeMin: 150,
      sizeMax: 250,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/plots');
    expect(calledUrl).toContain('colonyId=col-1');
    expect(calledUrl).toContain('status=available');
    expect(calledUrl).toContain('rateType=total');
    expect(calledUrl).toContain('sizeMin=150');
    expect(calledUrl).toContain('sizeMax=250');

    // Multi-tenant Security Check: firmId must NEVER be in query parameters
    expect(calledUrl).not.toContain('firmId');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].plotRef).toBe('P-101');
    expect(result.data[0].sizeUnit).toBe('sqyd');

    // ABSOLUTE PRIVACY BARRIER: public plot record must NEVER contain private owner/source fields
    const publicPlot = result.data[0] as unknown as Record<string, unknown>;
    expect(publicPlot.ownerName).toBeUndefined();
    expect(publicPlot.ownerPhone).toBeUndefined();
    expect(publicPlot.sellerContact).toBeUndefined();
    expect(publicPlot.sourceDetails).toBeUndefined();
    expect(publicPlot.privateNotes).toBeUndefined();
  });

  it('verifies all supported size units, rate types, and statuses match backend specifications', () => {
    expect(PLOT_SIZE_UNITS).toEqual(['sqft', 'sqyd', 'sqm', 'marla', 'kanal', 'acre', 'gaj']);
    expect(PLOT_RATE_TYPES).toEqual(['total', 'per_unit']);
    expect(PLOT_STATUSES).toEqual(['available', 'sold', 'reserved', 'on_hold']);
  });

  it('creates a public plot successfully with validated fields', async () => {
    const newPlotInput = {
      plotRef: 'PLOT-WEST-55',
      colonyId: 'colony-abc',
      size: 1500,
      sizeUnit: 'sqft' as const,
      rate: 3500,
      rateType: 'per_unit' as const,
      status: 'available' as const,
      videoUrl: 'https://vimeo.com/123456789',
      description: 'Corner plot with road access',
    };

    const createdPlot = {
      id: 'plot-55',
      plotId: newPlotInput.plotRef,
      plotRef: newPlotInput.plotRef,
      firmId: 'firm-tenant-123',
      colonyId: newPlotInput.colonyId,
      size: newPlotInput.size,
      sizeUnit: newPlotInput.sizeUnit,
      rate: newPlotInput.rate,
      rateType: newPlotInput.rateType,
      currency: 'INR',
      status: newPlotInput.status,
      videoUrl: newPlotInput.videoUrl,
      videoProvider: 'vimeo',
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
        data: createdPlot,
      }),
    });
    global.fetch = fetchMock;

    const result = await plotsApi.createPlot(newPlotInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.plotRef).toBe('PLOT-WEST-55');
    expect(sentBody.sizeUnit).toBe('sqft');
    expect(sentBody.rateType).toBe('per_unit');
    // Multi-tenant Security: client must NEVER supply firmId in request body
    expect(sentBody.firmId).toBeUndefined();

    expect(result.id).toBe('plot-55');
    expect(result.videoProvider).toBe('vimeo');
  });

  it('handles duplicate plot reference conflict (409 PLOT_REF_CONFLICT)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'PLOT_REF_CONFLICT',
          message: "Plot with reference 'PLOT-A1' already exists in your firm",
        },
      }),
    });

    try {
      await plotsApi.createPlot({
        plotRef: 'PLOT-A1',
        size: 200,
        sizeUnit: 'sqyd',
        rate: 5000000,
      });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('PLOT_REF_CONFLICT');
    }
  });

  it('handles invalid colony error (400 INVALID_COLONY)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'INVALID_COLONY',
          message: 'Colony does not exist or does not belong to your firm',
        },
      }),
    });

    try {
      await plotsApi.createPlot({
        plotRef: 'PLOT-A2',
        colonyId: 'foreign-colony-id',
        size: 200,
        sizeUnit: 'sqyd',
        rate: 5000000,
      });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe('INVALID_COLONY');
    }
  });

  it('handles invalid video URL error (400 INVALID_VIDEO_URL)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'INVALID_VIDEO_URL',
          message: 'Video URL host is not a supported video provider',
        },
      }),
    });

    try {
      await plotsApi.createPlot({
        plotRef: 'PLOT-A3',
        size: 200,
        sizeUnit: 'sqyd',
        rate: 5000000,
        videoUrl: 'https://unauthorized-domain.com/video.mp4',
      });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe('INVALID_VIDEO_URL');
    }
  });

  it('updates an existing plot', async () => {
    const updated = {
      id: 'plot-1',
      plotRef: 'PLOT-A1-REVISED',
      size: 220,
      sizeUnit: 'sqyd',
      rate: 5200000,
      rateType: 'total',
      status: 'reserved',
      isActive: true,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T13:00:00.000Z',
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

    const result = await plotsApi.updatePlot('plot-1', {
      plotRef: 'PLOT-A1-REVISED',
      status: 'reserved',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/plots/plot-1');
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('PATCH');
    expect(result.status).toBe('reserved');
  });

  it('deactivates a plot (soft delete)', async () => {
    const deactivated = {
      id: 'plot-1',
      plotRef: 'PLOT-A1',
      isActive: false,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T13:30:00.000Z',
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

    const result = await plotsApi.deactivatePlot('plot-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('DELETE');
    expect(result.isActive).toBe(false);
  });
});

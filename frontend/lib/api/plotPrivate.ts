/**
 * frontend/lib/api/plotPrivate.ts
 *
 * Dedicated confidential Plot Owner & Source feature API service.
 * Communicates with backend /api/plots/:plotId/private routes.
 *
 * Strict Privacy & Multi-Tenant Invariants:
 *  - Requests data only for the selected plot.
 *  - Tenant isolation is strictly enforced server-side via JWT auth (never passes firmId).
 *  - Distinguishes empty private records (HTTP 404 code PRIVATE_RECORD_NOT_FOUND) from
 *    cross-tenant/missing plot errors (HTTP 404 code PLOT_NOT_FOUND) and network errors.
 *  - Never logs or exposes confidential owner/source payload values.
 */

import { apiClient } from './client';
import { ApiClientError } from './errors';
import {
  PlotPrivate,
  UpsertPlotPrivateInput,
  PatchPlotPrivateInput,
} from '@/types/plotPrivate';

export const plotPrivateApi = {
  /**
   * Retrieves confidential owner and source details for a specific plot.
   * Returns null if the plot exists but has no private details recorded yet (HTTP 404 PRIVATE_RECORD_NOT_FOUND).
   * Throws ApiClientError for authorization errors (403), non-existent plots (PLOT_NOT_FOUND), or network issues.
   */
  async getPlotPrivate(plotId: string): Promise<PlotPrivate | null> {
    try {
      const res = await apiClient.get<PlotPrivate>(`/plots/${plotId}/private`);
      return res.data;
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === 'PRIVATE_RECORD_NOT_FOUND') {
        // Legitimate empty state: plot exists for this firm, but no private record has been saved yet
        return null;
      }
      throw err;
    }
  },

  /**
   * Creates or completely replaces confidential owner and source details (PUT /upsert).
   * Backend validates allowed fields via putPlotPrivateSchema.strict().
   */
  async upsertPlotPrivate(
    plotId: string,
    data: UpsertPlotPrivateInput
  ): Promise<PlotPrivate> {
    const res = await apiClient.put<PlotPrivate>(`/plots/${plotId}/private`, data);
    return res.data;
  },

  /**
   * Partially updates confidential owner and source details (PATCH).
   */
  async patchPlotPrivate(
    plotId: string,
    data: PatchPlotPrivateInput
  ): Promise<PlotPrivate> {
    const res = await apiClient.patch<PlotPrivate>(`/plots/${plotId}/private`, data);
    return res.data;
  },

  /**
   * Permanently deletes confidential owner and source details for a plot (DELETE).
   */
  async deletePlotPrivate(plotId: string): Promise<{ message: string }> {
    const res = await apiClient.delete<{ message: string }>(`/plots/${plotId}/private`);
    return res.data;
  },
};

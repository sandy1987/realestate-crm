import { apiClient, ApiResponseResult } from './client';
import {
  Plot,
  CreatePlotInput,
  UpdatePlotInput,
  PlotQueryParams,
} from '@/types/plot';

/**
 * Public Plot feature API service communicating with backend /api/plots routes.
 * Strictly adheres to multi-tenant isolation (tenant context is established via JWT on backend).
 * NEVER passes firmId from client.
 * NEVER requests, displays, or exposes private owner/source details.
 */
export const plotsApi = {
  /**
   * Lists public plots for the authenticated firm with filtering, searching, and pagination.
   */
  async listPlots(params?: PlotQueryParams): Promise<ApiResponseResult<Plot[]>> {
    return apiClient.get<Plot[]>('/plots', {
      params: params as Record<string, string | number | boolean | undefined | null>,
    });
  },

  /**
   * Retrieves a single public plot by ID for the authenticated firm.
   */
  async getPlot(plotId: string): Promise<Plot> {
    const res = await apiClient.get<Plot>(`/plots/${plotId}`);
    return res.data;
  },

  /**
   * Creates a new public plot in the authenticated firm.
   */
  async createPlot(data: CreatePlotInput): Promise<Plot> {
    const res = await apiClient.post<Plot>('/plots', data);
    return res.data;
  },

  /**
   * Updates an existing public plot in the authenticated firm.
   */
  async updatePlot(plotId: string, data: UpdatePlotInput): Promise<Plot> {
    const res = await apiClient.patch<Plot>(`/plots/${plotId}`, data);
    return res.data;
  },

  /**
   * Deactivates a plot (soft deletion).
   */
  async deactivatePlot(plotId: string): Promise<Plot> {
    const res = await apiClient.delete<Plot>(`/plots/${plotId}`);
    return res.data;
  },

  /**
   * Retrieves formatted WhatsApp marketing details and pre-built share URLs.
   */
  async getWhatsAppShare(plotId: string): Promise<PlotWhatsAppShareData> {
    const res = await apiClient.get<PlotWhatsAppShareData>(`/plots/${plotId}/share-whatsapp`);
    return res.data;
  },
};

export interface PlotWhatsAppShareData {
  plotId: string;
  plotRef: string;
  messageText: string;
  whatsappWebUrl: string;
  whatsappApiUrl: string;
}


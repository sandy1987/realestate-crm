import { apiClient, ApiResponseResult } from './client';
import {
  Firm,
  CreateFirmInput,
  ProvisionFirmResult,
  FirmQueryParams,
} from '@/types/firm';

/**
 * Platform Firm feature API service communicating with /api/platform/firms endpoints.
 * Strictly restricted to platform administrators (SUPER_ADMIN).
 * Tenant users are rejected with HTTP 403 PLATFORM_ACCESS_DENIED.
 */
export const platformFirmsApi = {
  /**
   * Lists all registered tenant firms with pagination, sorting, and search.
   */
  async listFirms(params?: FirmQueryParams): Promise<ApiResponseResult<Firm[]>> {
    return apiClient.get<Firm[]>('/platform/firms', {
      params: params as Record<string, string | number | boolean | undefined | null>,
    });
  },

  /**
   * Retrieves single firm details by its ObjectId.
   */
  async getFirm(firmId: string): Promise<Firm> {
    const res = await apiClient.get<Firm>(`/platform/firms/${firmId}`);
    return res.data;
  },

  /**
   * Provisions a new firm tenant organization and optionally its initial FIRM_ADMIN.
   */
  async createFirm(data: CreateFirmInput): Promise<ProvisionFirmResult> {
    const res = await apiClient.post<ProvisionFirmResult>('/platform/firms', data);
    return res.data;
  },

  /**
   * Suspends an active firm organization (disables access for all firm members).
   */
  async suspendFirm(firmId: string): Promise<Firm> {
    const res = await apiClient.post<Firm>(`/platform/firms/${firmId}/suspend`);
    return res.data;
  },

  /**
   * Activates a suspended firm organization.
   */
  async activateFirm(firmId: string): Promise<Firm> {
    const res = await apiClient.post<Firm>(`/platform/firms/${firmId}/activate`);
    return res.data;
  },
};

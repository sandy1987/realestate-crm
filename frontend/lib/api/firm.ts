import { apiClient } from './client';
import { Firm } from '@/types/firm';

/**
 * Tenant Firm API service communicating with /api/firm endpoints.
 * Strictly scoped to the authenticated tenant member via backend JWT context.
 * SUPER_ADMIN is rejected with HTTP 403.
 */
export const firmApi = {
  /**
   * Retrieves profile details for the authenticated user's firm tenant.
   */
  async getMyFirm(): Promise<Firm> {
    const res = await apiClient.get<Firm>('/firm/me');
    return res.data;
  },
};

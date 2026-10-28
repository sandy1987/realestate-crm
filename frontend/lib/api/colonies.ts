import { apiClient, ApiResponseResult } from './client';
import {
  Colony,
  CreateColonyInput,
  UpdateColonyInput,
  ColonyQueryParams,
} from '@/types/colony';

/**
 * Colony feature API service communicating with backend /api/colonies routes.
 * Strictly adheres to multi-tenant isolation (tenant context is established via JWT on backend).
 * NEVER passes firmId from client.
 */
export const coloniesApi = {
  /**
   * Lists colonies for the authenticated firm with optional search, filtering, and pagination.
   */
  async listColonies(params?: ColonyQueryParams): Promise<ApiResponseResult<Colony[]>> {
    return apiClient.get<Colony[]>('/colonies', {
      params: params as Record<string, string | number | boolean | undefined | null>,
    });
  },

  /**
   * Retrieves a single colony by ID for the authenticated firm.
   */
  async getColony(colonyId: string): Promise<Colony> {
    const res = await apiClient.get<Colony>(`/colonies/${colonyId}`);
    return res.data;
  },

  /**
   * Creates a new colony in the authenticated firm.
   */
  async createColony(data: CreateColonyInput): Promise<Colony> {
    const res = await apiClient.post<Colony>('/colonies', data);
    return res.data;
  },

  /**
   * Updates an existing colony in the authenticated firm.
   */
  async updateColony(colonyId: string, data: UpdateColonyInput): Promise<Colony> {
    const res = await apiClient.patch<Colony>(`/colonies/${colonyId}`, data);
    return res.data;
  },

  /**
   * Deactivates a colony (soft deletion).
   * Backend returns 400 COLONY_IN_USE if active plots reference this colony.
   */
  async deactivateColony(colonyId: string): Promise<Colony> {
    const res = await apiClient.delete<Colony>(`/colonies/${colonyId}`);
    return res.data;
  },
};

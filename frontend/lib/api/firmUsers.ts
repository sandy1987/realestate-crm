import { apiClient, ApiResponseResult } from './client';
import {
  UserSummary,
  CreateStaffInput,
  UpdateStaffInput,
  UpdateStaffStatusInput,
  FirmUserQueryParams,
} from '@/types/user';

/**
 * Firm-scoped user and staff administration API service.
 * Endpoints are guarded by requireAuth, requireTenantContext, and requireRole(FIRM_ADMIN).
 * SUPER_ADMIN and FIRM_STAFF are rejected with HTTP 403.
 * Scoping is strictly derived on the backend from req.tenant.firmId.
 */
export const firmUsersApi = {
  /**
   * Lists all staff and admin accounts belonging to the authenticated firm.
   */
  async listStaff(params?: FirmUserQueryParams): Promise<ApiResponseResult<UserSummary[]>> {
    return apiClient.get<UserSummary[]>('/firm/users', {
      params: params as Record<string, string | number | boolean | undefined | null>,
    });
  },

  /**
   * Retrieves single user account details scoped to the authenticated firm.
   */
  async getStaff(userId: string): Promise<UserSummary> {
    const res = await apiClient.get<UserSummary>(`/firm/users/${userId}`);
    return res.data;
  },

  /**
   * Creates a new FIRM_STAFF account in the authenticated firm.
   */
  async createStaff(data: CreateStaffInput): Promise<UserSummary> {
    const res = await apiClient.post<UserSummary>('/firm/users', data);
    return res.data;
  },

  /**
   * Updates profile information and granted permissions for a firm user.
   */
  async updateStaff(userId: string, data: UpdateStaffInput): Promise<UserSummary> {
    const res = await apiClient.patch<UserSummary>(`/firm/users/${userId}`, data);
    return res.data;
  },

  /**
   * Activates, deactivates, or suspends a firm user account.
   * Backend prevents self-deactivation (returns 400 CANNOT_MODIFY_OWN_STATUS).
   */
  async updateStaffStatus(userId: string, data: UpdateStaffStatusInput): Promise<UserSummary> {
    const res = await apiClient.patch<UserSummary>(`/firm/users/${userId}/status`, data);
    return res.data;
  },
};

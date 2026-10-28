import { apiClient } from './client';
import {
  LoginCredentials,
  LoginResponseData,
  RefreshResponseData,
  ChangePasswordInput,
  ChangePasswordResponseData,
} from '@/types/auth';
import { UserSummary } from '@/types/user';

/**
 * Authentication API Service functions connecting to backend /api/auth/* endpoints.
 */
export const authApi = {
  /**
   * Authenticates user credentials via POST /auth/login
   */
  async login(credentials: LoginCredentials): Promise<LoginResponseData> {
    const res = await apiClient.post<LoginResponseData>('/auth/login', credentials, {
      skipAuth: true,
    });
    return res.data;
  },

  /**
   * Rotates refresh token via POST /auth/refresh
   */
  async refresh(refreshToken: string): Promise<RefreshResponseData> {
    const res = await apiClient.post<RefreshResponseData>(
      '/auth/refresh',
      { refreshToken },
      { skipAuth: true }
    );
    return res.data;
  },

  /**
   * Revokes user refresh token session via POST /auth/logout
   */
  async logout(refreshToken: string): Promise<void> {
    await apiClient.post<{ message: string }>('/auth/logout', { refreshToken });
  },

  /**
   * Retrieves current authenticated user profile via GET /auth/me
   */
  async getMe(): Promise<UserSummary> {
    const res = await apiClient.get<UserSummary>('/auth/me');
    return res.data;
  },

  /**
   * Authenticated password change via POST /auth/change-password
   */
  async changePassword(input: ChangePasswordInput): Promise<ChangePasswordResponseData> {
    const res = await apiClient.post<ChangePasswordResponseData>('/auth/change-password', input);
    return res.data;
  },
};

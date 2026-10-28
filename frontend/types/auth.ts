import { UserSummary } from './user';

/**
 * Authentication types matching backend contract in src/controllers/auth.controller.js.
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponseData {
  user: UserSummary;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface RefreshResponseData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: UserSummary;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponseData {
  message: string;
}

export interface AuthState {
  user: UserSummary | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

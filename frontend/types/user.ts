/**
 * User and RBAC types strictly matching backend contract in src/models/User.model.js,
 * src/schemas/firmUser.schema.js, and permissions constants.
 */

export type UserRole = 'SUPER_ADMIN' | 'FIRM_ADMIN' | 'FIRM_STAFF';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export const ALL_STAFF_PERMISSIONS = [
  'plots:read',
  'plots:write',
  'plots:delete',
  'plots:export',
  'colonies:read',
  'colonies:write',
  'private:read',
  'private:write',
  'audit:read',
] as const;

export type UserPermission = (typeof ALL_STAFF_PERMISSIONS)[number];

export interface UserSummary {
  id: string;
  _id?: string;
  email: string;
  role: UserRole;
  firmId: string | null;
  permissions: UserPermission[];
  firstName?: string | null;
  lastName?: string | null;
  name?: string;
  isActive: boolean;
  isSuspended: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FirmUser extends UserSummary {
  firmId: string;
}

export interface CreateStaffInput {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: 'FIRM_STAFF';
  permissions?: UserPermission[];
}

export interface UpdateStaffInput {
  firstName?: string | null;
  lastName?: string | null;
  permissions?: UserPermission[];
}

export interface UpdateStaffStatusInput {
  isActive?: boolean;
  isSuspended?: boolean;
}

export interface FirmUserQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'email' | 'firstName' | 'lastName' | 'role' | 'isActive' | 'lastLoginAt' | string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  search?: string;
  role?: 'FIRM_ADMIN' | 'FIRM_STAFF';
  isActive?: 'true' | 'false' | boolean;
  isSuspended?: 'true' | 'false' | boolean;
}

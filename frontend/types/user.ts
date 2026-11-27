/**
 * User and RBAC types strictly matching backend contract in src/models/User.model.js,
 * src/schemas/firmUser.schema.js, and permissions constants.
 */

export type UserRole = 'SUPER_ADMIN' | 'FIRM_ADMIN' | 'FIRM_STAFF';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export const ALL_STAFF_PERMISSIONS = [
  // Plots & Land
  'plots:read',
  'plots:write',
  'plots:delete',
  'plots:export',

  // Houses & Flats
  'houses:read',
  'houses:write',
  'houses:delete',
  'houses:export',

  // Agricultural Land
  'agricultural:read',
  'agricultural:write',
  'agricultural:delete',
  'agricultural:export',

  // Rental Properties
  'rentals:read',
  'rentals:write',
  'rentals:delete',
  'rentals:export',

  // Colonies & Masters
  'colonies:read',
  'colonies:write',

  // Confidential Owner Data (Firm Admin reserved)
  'private:read',
  'private:write',

  // Audit Logs
  'audit:read',
] as const;

export type UserPermission = (typeof ALL_STAFF_PERMISSIONS)[number];

export interface PermissionGroup {
  id: string;
  title: string;
  description: string;
  permissions: {
    key: UserPermission;
    label: string;
    description?: string;
  }[];
}

export const ADVISOR_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'plots',
    title: 'Plots & Land Inventory',
    description: 'Manage commercial and residential plot listings.',
    permissions: [
      { key: 'plots:read', label: 'plots:read (View Plots)' },
      { key: 'plots:write', label: 'plots:write (Add & Edit)' },
      { key: 'plots:delete', label: 'plots:delete (Deactivate)' },
      { key: 'plots:export', label: 'plots:export (Export CSV)' },
    ],
  },
  {
    id: 'houses',
    title: 'Houses & Flats',
    description: 'Manage ready-made houses, villas, and society flats.',
    permissions: [
      { key: 'houses:read', label: 'houses:read (View Houses & Flats)' },
      { key: 'houses:write', label: 'houses:write (Add & Edit)' },
      { key: 'houses:delete', label: 'houses:delete (Deactivate)' },
      { key: 'houses:export', label: 'houses:export (Export CSV)' },
    ],
  },
  {
    id: 'agricultural',
    title: 'Agricultural Land',
    description: 'Manage agricultural land, farmlands, and rural acreage.',
    permissions: [
      { key: 'agricultural:read', label: 'agricultural:read (View Farmlands)' },
      { key: 'agricultural:write', label: 'agricultural:write (Add & Edit)' },
      { key: 'agricultural:delete', label: 'agricultural:delete (Deactivate)' },
      { key: 'agricultural:export', label: 'agricultural:export (Export CSV)' },
    ],
  },
  {
    id: 'rentals',
    title: 'Rental Properties',
    description: 'Manage residential and commercial rental inventory.',
    permissions: [
      { key: 'rentals:read', label: 'rentals:read (View Rentals)' },
      { key: 'rentals:write', label: 'rentals:write (Add & Edit)' },
      { key: 'rentals:delete', label: 'rentals:delete (Deactivate)' },
      { key: 'rentals:export', label: 'rentals:export (Export CSV)' },
    ],
  },
  {
    id: 'colonies',
    title: 'Colonies & Master Setup',
    description: 'Manage colony and sector master configurations.',
    permissions: [
      { key: 'colonies:read', label: 'colonies:read (View Colonies)' },
      { key: 'colonies:write', label: 'colonies:write (Add & Edit)' },
    ],
  },
  {
    id: 'audit',
    title: 'Audit Trail',
    description: 'Access firm operational change and security logs.',
    permissions: [
      { key: 'audit:read', label: 'audit:read (View Audit Logs)' },
    ],
  },
];

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

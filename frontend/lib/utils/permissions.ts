import { UserSummary, UserPermission } from '@/types/user';

/**
 * Checks whether the current user has access to tenant-scoped operations.
 * SUPER_ADMIN is strictly prohibited from accessing tenant routes by architecture.
 */
export function canAccessTenant(user: UserSummary | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'FIRM_ADMIN' || user.role === 'FIRM_STAFF';
}

/**
 * Checks if the user is a platform administrator (SUPER_ADMIN).
 */
export function isSuperAdmin(user: UserSummary | null | undefined): boolean {
  return user?.role === 'SUPER_ADMIN';
}

/**
 * Checks if the user is a firm administrator (FIRM_ADMIN).
 */
export function isFirmAdmin(user: UserSummary | null | undefined): boolean {
  return user?.role === 'FIRM_ADMIN';
}

/**
 * Checks if the user is a firm staff member (FIRM_STAFF).
 */
export function isFirmStaff(user: UserSummary | null | undefined): boolean {
  return user?.role === 'FIRM_STAFF';
}

/**
 * Checks whether the user is authorized to manage firm staff accounts.
 * Backend strictly restricts /api/firm/users to FIRM_ADMIN role.
 */
export function canManageStaff(user: UserSummary | null | undefined): boolean {
  return user?.role === 'FIRM_ADMIN';
}

/**
 * Checks whether the user holds a specific permission.
 * - SUPER_ADMIN: returns false for tenant operations (must not invoke tenant APIs).
 * - FIRM_ADMIN: returns true for all tenant operations (implicit permissions).
 * - FIRM_STAFF: checks explicit user.permissions array.
 */
export function hasPermission(
  user: UserSummary | null | undefined,
  permission: UserPermission | string
): boolean {
  if (!user) return false;

  if (user.role === 'SUPER_ADMIN') {
    return false;
  }

  if (user.role === 'FIRM_ADMIN') {
    return true;
  }

  if (user.role === 'FIRM_STAFF') {
    return Array.isArray(user.permissions) && user.permissions.includes(permission as UserPermission);
  }

  return false;
}

/**
 * Checks whether the user can access the tenant audit trail (/firm/audit).
 * FIRM_ADMIN has implicit access; FIRM_STAFF requires explicit 'audit:read'.
 * SUPER_ADMIN is strictly prohibited from tenant routes.
 */
export function canReadTenantAudit(user: UserSummary | null | undefined): boolean {
  return hasPermission(user, 'audit:read');
}

/**
 * Checks whether the user can access the platform audit trail (/platform/audit).
 * Restricted strictly to platform administrators (SUPER_ADMIN).
 */
export function canReadPlatformAudit(user: UserSummary | null | undefined): boolean {
  return isSuperAdmin(user);
}

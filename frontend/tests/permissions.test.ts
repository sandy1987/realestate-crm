import { describe, it, expect } from 'vitest';
import { hasPermission, canAccessTenant, isSuperAdmin } from '../lib/utils/permissions';
import { UserSummary } from '../types/user';

describe('Permissions & Tenant Boundary Utilities', () => {
  const superAdminUser: UserSummary = {
    id: 'user-sa',
    email: 'superadmin@agentbroker.local',
    role: 'SUPER_ADMIN',
    firmId: null,
    permissions: [],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const firmAdminUser: UserSummary = {
    id: 'user-fa',
    email: 'admin@firm1.local',
    role: 'FIRM_ADMIN',
    firmId: 'firm-1',
    permissions: [],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const firmStaffWithColonies: UserSummary = {
    id: 'user-staff-1',
    email: 'staff1@firm1.local',
    role: 'FIRM_STAFF',
    firmId: 'firm-1',
    permissions: ['colonies:read', 'colonies:write'],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  const firmStaffWithPlotsRead: UserSummary = {
    id: 'user-staff-2',
    email: 'staff2@firm1.local',
    role: 'FIRM_STAFF',
    firmId: 'firm-1',
    permissions: ['plots:read'],
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };

  describe('isSuperAdmin', () => {
    it('identifies platform administrator correctly', () => {
      expect(isSuperAdmin(superAdminUser)).toBe(true);
      expect(isSuperAdmin(firmAdminUser)).toBe(false);
      expect(isSuperAdmin(firmStaffWithColonies)).toBe(false);
      expect(isSuperAdmin(null)).toBe(false);
      expect(isSuperAdmin(undefined)).toBe(false);
    });
  });

  describe('canAccessTenant', () => {
    it('restricts SUPER_ADMIN from tenant workspace', () => {
      expect(canAccessTenant(superAdminUser)).toBe(false);
    });

    it('allows FIRM_ADMIN and FIRM_STAFF into tenant workspace', () => {
      expect(canAccessTenant(firmAdminUser)).toBe(true);
      expect(canAccessTenant(firmStaffWithColonies)).toBe(true);
    });

    it('denies unauthenticated visitors', () => {
      expect(canAccessTenant(null)).toBe(false);
      expect(canAccessTenant(undefined)).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('denies SUPER_ADMIN on all tenant permissions', () => {
      expect(hasPermission(superAdminUser, 'colonies:read')).toBe(false);
      expect(hasPermission(superAdminUser, 'colonies:write')).toBe(false);
      expect(hasPermission(superAdminUser, 'plots:read')).toBe(false);
      expect(hasPermission(superAdminUser, 'plots:write')).toBe(false);
      expect(hasPermission(superAdminUser, 'plots:delete')).toBe(false);
    });

    it('grants FIRM_ADMIN all tenant permissions implicitly', () => {
      expect(hasPermission(firmAdminUser, 'colonies:read')).toBe(true);
      expect(hasPermission(firmAdminUser, 'colonies:write')).toBe(true);
      expect(hasPermission(firmAdminUser, 'plots:read')).toBe(true);
      expect(hasPermission(firmAdminUser, 'plots:write')).toBe(true);
      expect(hasPermission(firmAdminUser, 'plots:delete')).toBe(true);
    });

    it('evaluates explicit permissions strictly for FIRM_STAFF', () => {
      // Staff 1 has colonies:read and colonies:write
      expect(hasPermission(firmStaffWithColonies, 'colonies:read')).toBe(true);
      expect(hasPermission(firmStaffWithColonies, 'colonies:write')).toBe(true);
      expect(hasPermission(firmStaffWithColonies, 'plots:read')).toBe(false);
      expect(hasPermission(firmStaffWithColonies, 'plots:write')).toBe(false);

      // Staff 2 has only plots:read
      expect(hasPermission(firmStaffWithPlotsRead, 'plots:read')).toBe(true);
      expect(hasPermission(firmStaffWithPlotsRead, 'plots:write')).toBe(false);
      expect(hasPermission(firmStaffWithPlotsRead, 'plots:delete')).toBe(false);
      expect(hasPermission(firmStaffWithPlotsRead, 'colonies:read')).toBe(false);
    });

    it('handles null and undefined gracefully', () => {
      expect(hasPermission(null, 'plots:read')).toBe(false);
      expect(hasPermission(undefined, 'plots:read')).toBe(false);
    });
  });
});

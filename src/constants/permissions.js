/**
 * src/constants/permissions.js
 *
 * Granular permission strings for FIRM_STAFF.
 * FIRM_ADMIN gains all of these implicitly via role — no array needed.
 * SUPER_ADMIN has no access to tenant-owned resources.
 */

export const PERMS = Object.freeze({
  // Plots
  PLOTS_READ:   'plots:read',
  PLOTS_WRITE:  'plots:write',
  PLOTS_DELETE: 'plots:delete',
  PLOTS_EXPORT: 'plots:export',

  // Colonies
  COLONIES_READ:  'colonies:read',
  COLONIES_WRITE: 'colonies:write',

  // Private owner/source data — denied by default; explicit grant required
  PRIVATE_READ:  'private:read',
  PRIVATE_WRITE: 'private:write',

  // Audit log read access
  AUDIT_READ: 'audit:read',
});

/** Flat array of all valid permission strings — used by Mongoose schema enum. */
export const ALL_PERMISSIONS = Object.values(PERMS);

/**
 * src/constants/permissions.js
 *
 * Granular permission strings for FIRM_STAFF.
 * FIRM_ADMIN gains all of these implicitly via role — no array needed.
 * SUPER_ADMIN has no access to tenant-owned resources.
 */

export const PERMS = Object.freeze({
  // Plots & Land Inventory
  PLOTS_READ:   'plots:read',
  PLOTS_WRITE:  'plots:write',
  PLOTS_DELETE: 'plots:delete',
  PLOTS_EXPORT: 'plots:export',

  // Houses & Flats Inventory
  HOUSES_READ:   'houses:read',
  HOUSES_WRITE:  'houses:write',
  HOUSES_DELETE: 'houses:delete',
  HOUSES_EXPORT: 'houses:export',

  // Agricultural Land Inventory
  AGRICULTURAL_READ:   'agricultural:read',
  AGRICULTURAL_WRITE:  'agricultural:write',
  AGRICULTURAL_DELETE: 'agricultural:delete',
  AGRICULTURAL_EXPORT: 'agricultural:export',

  // Rental Properties Inventory
  RENTALS_READ:   'rentals:read',
  RENTALS_WRITE:  'rentals:write',
  RENTALS_DELETE: 'rentals:delete',
  RENTALS_EXPORT: 'rentals:export',

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

/**
 * src/constants/auditEvents.js
 *
 * System-wide audit event identifiers.
 * Emitted to AuditLog for security-relevant and compliance actions.
 */

export const AUDIT_EVENTS = Object.freeze({
  // Platform events
  FIRM_PROVISIONED: 'platform.firm.provisioned',
  FIRM_UPDATED:     'platform.firm.updated',
  FIRM_SUSPENDED:   'platform.firm.suspended',
  FIRM_ACTIVATED:   'platform.firm.activated',

  // Authentication events
  AUTH_LOGIN_SUCCESS:    'auth.login.success',
  AUTH_LOGIN_FAILURE:    'auth.login.failure',
  AUTH_TOKEN_REFRESHED:  'auth.token.refreshed',
  AUTH_LOGOUT:           'auth.logout',
  AUTH_PASSWORD_CHANGED: 'auth.password.changed',

  // User management events
  USER_CREATED:   'user.created',
  USER_UPDATED:   'user.updated',
  USER_SUSPENDED: 'user.suspended',
  USER_ACTIVATED: 'user.activated',

  // Colony events
  COLONY_CREATED: 'colony.created',
  COLONY_UPDATED: 'colony.updated',
  COLONY_DELETED: 'colony.deleted',

  // Plot events
  PLOT_CREATED:         'plot.created',
  PLOT_UPDATED:         'plot.updated',
  PLOT_DELETED:         'plot.deleted',
  PLOT_EXPORTED:        'plot.exported',
  PLOT_SHARED_WHATSAPP: 'plot.shared.whatsapp',

  // Private owner/source events
  PRIVATE_DATA_READ:    'plot.private.read',
  PRIVATE_DATA_UPSERT:  'plot.private.upsert',
  PRIVATE_DATA_UPDATED: 'plot.private.updated',
  PRIVATE_DATA_DELETED: 'plot.private.deleted',
});

export const ALL_AUDIT_EVENTS = Object.values(AUDIT_EVENTS);

/**
 * frontend/types/audit.ts
 *
 * Audit trail and compliance types strictly matching backend contract in
 * src/models/AuditLog.model.js, src/schemas/audit.schema.js, and src/constants/auditEvents.js.
 */

export const AUDIT_EVENT_TYPES = [
  // Platform events
  'platform.firm.provisioned',
  'platform.firm.updated',
  'platform.firm.suspended',
  'platform.firm.activated',

  // Authentication events
  'auth.login.success',
  'auth.login.failure',
  'auth.token.refreshed',
  'auth.logout',
  'auth.password.changed',

  // User management events
  'user.created',
  'user.updated',
  'user.suspended',
  'user.activated',

  // Colony events
  'colony.created',
  'colony.updated',
  'colony.deleted',

  // Plot events
  'plot.created',
  'plot.updated',
  'plot.deleted',
  'plot.exported',

  // Private owner/source events
  'plot.private.read',
  'plot.private.upsert',
  'plot.private.updated',
  'plot.private.deleted',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditOutcome = 'success' | 'failure';

export interface AuditLog {
  id: string;
  eventType: AuditEventType | string;
  actorUserId: string | null;
  actorRole: string | null;
  firmId: string | null;
  resourceType: string;
  resourceId: string | null;
  action: string;
  outcome: AuditOutcome;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'eventType' | 'resourceType' | 'outcome' | 'action' | string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  eventType?: AuditEventType | string;
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: AuditOutcome;
  dateFrom?: string;
  dateTo?: string;

  // Platform audit only (SUPER_ADMIN)
  firmId?: string;
  platformOnly?: 'true' | 'false' | boolean;
}

/**
 * frontend/lib/api/audit.ts
 *
 * Dedicated Audit Trail API service.
 * Supports both tenant-scoped (/firm/audit) and platform-scoped (/platform/audit) endpoints.
 *
 * Strict Multi-Tenant & Platform Isolation Invariants:
 *  - Tenant queries strictly NEVER send firmId; tenant context is established server-side from JWT.
 *  - Platform queries use /platform/audit (SUPER_ADMIN only).
 *  - Read-only: no creation, update, or deletion operations exist.
 */

import { apiClient, ApiResponseResult } from './client';
import { AuditLog, AuditQueryParams } from '@/types/audit';

export const auditApi = {
  /**
   * Retrieves tenant-scoped audit logs for the authenticated firm.
   * Scoped strictly to the caller's firm on the backend.
   * Requires FIRM_ADMIN or FIRM_STAFF with audit:read permission.
   */
  async listFirmAuditLogs(params?: AuditQueryParams): Promise<ApiResponseResult<AuditLog[]>> {
    // Strip platform-only parameters and ensure firmId is never sent by client
    const safeParams: Record<string, string | number | boolean | undefined | null> = {};

    if (params) {
      if (params.page !== undefined) safeParams.page = params.page;
      if (params.limit !== undefined) safeParams.limit = params.limit;
      if (params.sortBy) safeParams.sortBy = params.sortBy;
      if (params.sortOrder) safeParams.sortOrder = params.sortOrder;
      if (params.eventType) safeParams.eventType = params.eventType;
      if (params.actorUserId) safeParams.actorUserId = params.actorUserId;
      if (params.resourceType) safeParams.resourceType = params.resourceType;
      if (params.resourceId) safeParams.resourceId = params.resourceId;
      if (params.outcome) safeParams.outcome = params.outcome;
      if (params.dateFrom) safeParams.dateFrom = params.dateFrom;
      if (params.dateTo) safeParams.dateTo = params.dateTo;
    }

    return apiClient.get<AuditLog[]>('/firm/audit', {
      params: safeParams,
    });
  },

  /**
   * Retrieves platform-scoped audit logs across all firms and platform events.
   * Accessible strictly to SUPER_ADMIN on the backend.
   */
  async listPlatformAuditLogs(params?: AuditQueryParams): Promise<ApiResponseResult<AuditLog[]>> {
    const safeParams: Record<string, string | number | boolean | undefined | null> = {};

    if (params) {
      if (params.page !== undefined) safeParams.page = params.page;
      if (params.limit !== undefined) safeParams.limit = params.limit;
      if (params.sortBy) safeParams.sortBy = params.sortBy;
      if (params.sortOrder) safeParams.sortOrder = params.sortOrder;
      if (params.eventType) safeParams.eventType = params.eventType;
      if (params.actorUserId) safeParams.actorUserId = params.actorUserId;
      if (params.resourceType) safeParams.resourceType = params.resourceType;
      if (params.resourceId) safeParams.resourceId = params.resourceId;
      if (params.outcome) safeParams.outcome = params.outcome;
      if (params.dateFrom) safeParams.dateFrom = params.dateFrom;
      if (params.dateTo) safeParams.dateTo = params.dateTo;
      if (params.firmId) safeParams.firmId = params.firmId;
      if (params.platformOnly !== undefined) {
        safeParams.platformOnly = String(params.platformOnly);
      }
    }

    return apiClient.get<AuditLog[]>('/platform/audit', {
      params: safeParams,
    });
  },
};

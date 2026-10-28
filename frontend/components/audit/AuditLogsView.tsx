/**
 * frontend/components/audit/AuditLogsView.tsx
 *
 * Primary container for Audit Logs and Activity History.
 * Supports both tenant (/firm/audit) and platform (/platform/audit) modes.
 *
 * Role & Security Rules:
 *  - mode="tenant": Strictly requires FIRM_ADMIN or FIRM_STAFF with audit:read. Rejects SUPER_ADMIN.
 *  - mode="platform": Strictly requires SUPER_ADMIN. Rejects tenant users.
 *  - Reconciles and resets pagination cleanly on filter updates.
 *  - Stale request cancellation prevents out-of-order state corruption.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { isSuperAdmin, canReadTenantAudit } from '@/lib/utils/permissions';
import { auditApi } from '@/lib/api/audit';
import { AuditLog, AuditQueryParams } from '@/types/audit';
import { PaginationMeta } from '@/types/api';
import { AuditFilters } from './AuditFilters';
import { AuditTable } from './AuditTable';
import { AuditDetailModal } from './AuditDetailModal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Loading';
import { ShieldCheck, ShieldAlert, ChevronLeft, ChevronRight, AlertCircle, RotateCw } from 'lucide-react';

export interface AuditLogsViewProps {
  mode: 'tenant' | 'platform';
}

const DEFAULT_LIMIT = 20;

export function AuditLogsView({ mode }: AuditLogsViewProps) {
  const { user } = useAuth();
  const isPlatformMode = mode === 'platform';
  const isPlatformAdmin = isSuperAdmin(user);
  const canAccessTenantAudit = canReadTenantAudit(user);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<AuditQueryParams>({
    page: 1,
    limit: DEFAULT_LIMIT,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Modal inspection state
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLog | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Stale request guard
  const activeRequestIdRef = useRef(0);

  const fetchAuditLogs = useCallback(
    async (currentFilters: AuditQueryParams) => {
      // Authorization boundary guards
      if (isPlatformMode && !isPlatformAdmin) {
        setIsLoading(false);
        return;
      }
      if (!isPlatformMode && (!canAccessTenantAudit || isPlatformAdmin)) {
        setIsLoading(false);
        return;
      }

      const currentRequestId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const res = isPlatformMode
          ? await auditApi.listPlatformAuditLogs(currentFilters)
          : await auditApi.listFirmAuditLogs(currentFilters);

        if (currentRequestId === activeRequestIdRef.current) {
          setLogs(res.data);
          setMeta(res.meta || null);
        }
      } catch (err: unknown) {
        if (currentRequestId === activeRequestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve audit log trail.');
        }
      } finally {
        if (currentRequestId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [isPlatformMode, isPlatformAdmin, canAccessTenantAudit]
  );

  // Synchronize listing on filter or pagination changes
  useEffect(() => {
    let isMounted = true;

    async function sync() {
      await Promise.resolve();
      if (isMounted) {
        void fetchAuditLogs(filters);
      }
    }

    void sync();

    return () => {
      isMounted = false;
    };
  }, [filters, fetchAuditLogs]);

  const handleFilterChange = (newFilters: Partial<AuditQueryParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page ?? 1,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: DEFAULT_LIMIT,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const handleRefresh = () => {
    void fetchAuditLogs(filters);
  };

  const handleSelectLog = (log: AuditLog) => {
    setSelectedLogForDetail(log);
    setDetailModalOpen(true);
  };

  // SUPER_ADMIN boundary guard when trying to access tenant audit mode
  if (!isPlatformMode && isPlatformAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Tenant Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">Tenant-scoped operational audit trail.</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-6 text-center max-w-2xl mx-auto my-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-purple-900">Platform Administrator Restricted</h3>
          <p className="text-xs text-purple-700 mt-2 max-w-md mx-auto leading-relaxed">
            Super Administrators manage the global platform. Access to tenant-scoped audit routes is restricted by
            multi-tenant architecture. Please use the <strong>Platform Audit Trail</strong> or sign in with an authorized firm account.
          </p>
        </div>
      </div>
    );
  }

  // Tenant mode: FIRM_STAFF missing audit:read permission
  if (!isPlatformMode && !canAccessTenantAudit) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Security & Operational Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">Immutable compliance records of tenant activities.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center max-w-lg mx-auto my-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-amber-900">Access Restricted</h3>
          <p className="text-xs text-amber-700 mt-2">
            Your user account does not have the required <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">audit:read</code> permission. Contact your firm administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  // Platform mode: Non-SUPER_ADMIN attempted access
  if (isPlatformMode && !isPlatformAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Platform Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">Global platform activity log.</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center max-w-lg mx-auto my-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-red-900">Platform Administrator Required</h3>
          <p className="text-xs text-red-700 mt-2">
            This operational stream is restricted to Super Administrators managing the platform.
          </p>
        </div>
      </div>
    );
  }

  const hasFilterActive = Boolean(
    filters.eventType ||
      filters.outcome ||
      filters.resourceType ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.firmId ||
      filters.platformOnly
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {isPlatformMode ? 'Platform Audit Trail' : 'Security & Operational Audit Trail'}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                isPlatformMode
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {isPlatformMode ? 'Global Scope' : 'Tenant Scope'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isPlatformMode
              ? 'Immutable global audit log stream of tenant provisioning, system actions, and administrative activities.'
              : 'Immutable compliance trail of logins, inventory updates, user management, and confidential access events.'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <AuditFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        mode={mode}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh} leftIcon={<RotateCw className="h-3 w-3" />}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Table or Loading / Empty States */}
      {isLoading ? (
        <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title={hasFilterActive ? 'No matching audit events' : 'No audit records recorded'}
          description={
            hasFilterActive
              ? 'Try modifying or clearing your filter criteria to inspect other events.'
              : 'Security-relevant administrative and business actions will appear here automatically.'
          }
          actionLabel={hasFilterActive ? 'Clear Filters' : undefined}
          onAction={hasFilterActive ? handleResetFilters : undefined}
        />
      ) : (
        <div className="space-y-3">
          <AuditTable logs={logs} onSelectLog={handleSelectLog} mode={mode} />

          {/* Pagination Footer */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 shadow-2xs">
              <div>
                Showing page <strong className="text-slate-900">{meta.page}</strong> of{' '}
                <strong className="text-slate-900">{meta.totalPages}</strong> ({meta.total} total events)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFilterChange({ page: Math.max((filters.page || 1) - 1, 1) })}
                  disabled={(filters.page || 1) <= 1}
                  leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFilterChange({ page: (filters.page || 1) + 1 })}
                  disabled={(filters.page || 1) >= meta.totalPages}
                  rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Inspector Modal */}
      {detailModalOpen && (
        <AuditDetailModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          log={selectedLogForDetail}
        />
      )}
    </div>
  );
}

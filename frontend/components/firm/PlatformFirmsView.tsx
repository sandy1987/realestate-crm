'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { platformFirmsApi } from '@/lib/api/platformFirms';
import { Firm, ProvisionFirmResult } from '@/types/firm';
import { PaginationMeta } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Loading';
import { CreateFirmModal } from './CreateFirmModal';
import { FirmDetailsModal } from './FirmDetailsModal';
import { FirmStatusModal } from './FirmStatusModal';
import { formatDate } from '@/lib/utils/formatters';
import {
  Building2,
  Plus,
  Search,
  RotateCw,
  Eye,
  ShieldBan,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

export function PlatformFirmsView() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedFirmForDetails, setSelectedFirmForDetails] = useState<Firm | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedFirmForStatus, setSelectedFirmForStatus] = useState<Firm | null>(null);
  const [statusMode, setStatusMode] = useState<'suspend' | 'activate'>('suspend');

  // Success alert on new provisioning
  const [lastProvisioned, setLastProvisioned] = useState<ProvisionFirmResult | null>(null);

  const activeRequestIdRef = useRef(0);

  const executeFetch = useCallback(
    async (targetPage: number, targetSearch: string) => {
      const currentRequestId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const res = await platformFirmsApi.listFirms({
          page: targetPage,
          limit,
          search: targetSearch.trim() || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (currentRequestId === activeRequestIdRef.current) {
          setFirms(res.data);
          setMeta(res.meta || null);
        }
      } catch (err: unknown) {
        if (currentRequestId === activeRequestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch platform firms.');
        }
      } finally {
        if (currentRequestId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [limit]
  );

  // Synchronize listing on query/page change
  useEffect(() => {
    let isMounted = true;

    async function sync() {
      await Promise.resolve();
      if (isMounted) {
        void executeFetch(page, search);
      }
    }

    void sync();

    return () => {
      isMounted = false;
    };
  }, [page, search, executeFetch]);

  const handleRefresh = useCallback(() => {
    void executeFetch(page, search);
  }, [executeFetch, page, search]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleProvisionSuccess = (result: ProvisionFirmResult) => {
    setLastProvisioned(result);
    handleRefresh();
  };

  const handleViewDetails = (firm: Firm) => {
    setSelectedFirmForDetails(firm);
    setDetailsModalOpen(true);
  };

  const handleStatusClick = (firm: Firm, mode: 'suspend' | 'activate') => {
    setSelectedFirmForStatus(firm);
    setStatusMode(mode);
    setStatusModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Platform Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Platform Firm Management</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Platform Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Provision, monitor, and regulate tenant real estate organizations across the AGENT-Broker ecosystem.
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
          Provision Firm
        </Button>
      </div>

      {/* Provisioning Success Banner */}
      {lastProvisioned && (
        <div className="flex items-start justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">
                Firm &ldquo;{lastProvisioned.firm.name}&rdquo; ({lastProvisioned.firm.slug}) provisioned successfully!
              </p>
              {lastProvisioned.admin ? (
                <p className="text-emerald-700 mt-1">
                  Initial administrator provisioned: <strong className="font-mono">{lastProvisioned.admin.email}</strong>.
                </p>
              ) : (
                <p className="text-emerald-700 mt-1">
                  No initial administrator was provisioned. You can invite or assign a firm administrator separately.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setLastProvisioned(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search firms by organization name or slug..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="h-9"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          leftIcon={<RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
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
        </div>
      ) : firms.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title={search ? 'No matching firms found' : 'No tenant firms provisioned yet'}
          description={
            search
              ? 'Try modifying your search query.'
              : 'Provision your first real estate organization to start onboarding tenants.'
          }
          actionLabel={!search ? 'Provision First Firm' : undefined}
          onAction={!search ? () => setCreateModalOpen(true) : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Tenant Slug</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provisioned On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {firms.map((firm) => (
                <TableRow key={firm.id}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{firm.name}</div>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {firm.id}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                      {firm.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-700">
                      {firm.contactEmail ? <p>{firm.contactEmail}</p> : null}
                      {firm.contactPhone ? <p className="text-slate-500">{firm.contactPhone}</p> : null}
                      {!firm.contactEmail && !firm.contactPhone && <span className="text-slate-400">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={firm.isActive ? 'active' : 'suspended'} />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">{formatDate(firm.createdAt)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDetails(firm)}
                        aria-label={`View details of ${firm.name}`}
                        className="h-8 w-8 p-0"
                        title="View firm details"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-600" />
                      </Button>

                      {firm.isActive ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusClick(firm, 'suspend')}
                          aria-label={`Suspend ${firm.name}`}
                          className="h-8 w-8 p-0 hover:text-amber-600"
                          title="Suspend firm"
                        >
                          <ShieldBan className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusClick(firm, 'activate')}
                          aria-label={`Activate ${firm.name}`}
                          className="h-8 w-8 p-0 hover:text-emerald-600"
                          title="Activate firm"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Footer */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
              <div>
                Showing page <strong className="text-slate-900">{meta.page}</strong> of{' '}
                <strong className="text-slate-900">{meta.totalPages}</strong> ({meta.total} total firms)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={meta.page <= 1}
                  leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={meta.page >= meta.totalPages}
                  rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provision Firm Modal */}
      {createModalOpen && (
        <CreateFirmModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={handleProvisionSuccess}
        />
      )}

      {/* Firm Details Modal */}
      <FirmDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        firm={selectedFirmForDetails}
      />

      {/* Suspend / Activate Confirmation Modal */}
      {statusModalOpen && (
        <FirmStatusModal
          key={`${selectedFirmForStatus?.id}-${statusMode}`}
          open={statusModalOpen}
          onOpenChange={setStatusModalOpen}
          firm={selectedFirmForStatus}
          mode={statusMode}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}

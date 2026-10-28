'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, isSuperAdmin } from '@/lib/utils/permissions';
import { plotsApi } from '@/lib/api/plots';
import { coloniesApi } from '@/lib/api/colonies';
import { Plot, PlotStatus, PlotRateType } from '@/types/plot';
import { Colony } from '@/types/colony';
import { PaginationMeta } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Loading';
import { PlotFormModal } from '@/components/plots/PlotFormModal';
import { PlotDetailsModal } from '@/components/plots/PlotDetailsModal';
import { DeactivatePlotModal } from '@/components/plots/DeactivatePlotModal';
import { WhatsAppShareModal } from '@/components/plots/WhatsAppShareModal';
import { PlotPrivateModal } from '@/components/plots/PlotPrivateModal';
import { PlotPrivateFormModal } from '@/components/plots/PlotPrivateFormModal';
import { DeletePlotPrivateModal } from '@/components/plots/DeletePlotPrivateModal';
import { PlotPrivate } from '@/types/plotPrivate';
import { formatArea, formatPlotRate, formatDate } from '@/lib/utils/formatters';
import {
  Landmark,
  Plus,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  Eye,
  Video,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
} from 'lucide-react';

export default function PlotsPage() {
  const { user } = useAuth();

  const isPlatformAdmin = isSuperAdmin(user);
  const canRead = hasPermission(user, 'plots:read');
  const canWrite = hasPermission(user, 'plots:write');
  const canDelete = hasPermission(user, 'plots:delete');
  const canReadPrivate = !isPlatformAdmin && hasPermission(user, 'private:read');

  const [plots, setPlots] = useState<Plot[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination state
  const [search, setSearch] = useState('');
  const [colonyFilter, setColonyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rateTypeFilter, setRateTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedPlotForEdit, setSelectedPlotForEdit] = useState<Plot | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedPlotForDetails, setSelectedPlotForDetails] = useState<Plot | null>(null);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [selectedPlotForDeactivate, setSelectedPlotForDeactivate] = useState<Plot | null>(null);

  // WhatsApp share modal state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [selectedPlotForWhatsApp, setSelectedPlotForWhatsApp] = useState<Plot | null>(null);

  // Private owner/source modal states
  const [privateModalOpen, setPrivateModalOpen] = useState(false);
  const [selectedPlotForPrivate, setSelectedPlotForPrivate] = useState<Plot | null>(null);
  const [privateFormModalOpen, setPrivateFormModalOpen] = useState(false);
  const [initialPrivateDataForEdit, setInitialPrivateDataForEdit] = useState<PlotPrivate | null>(null);
  const [deletePrivateModalOpen, setDeletePrivateModalOpen] = useState(false);
  const [privateRefreshKey, setPrivateRefreshKey] = useState(0);

  // Stale request guard
  const activeRequestIdRef = useRef(0);

  // Load colonies lookup list asynchronously
  useEffect(() => {
    let isMounted = true;
    if (!isPlatformAdmin && canRead) {
      coloniesApi
        .listColonies({ limit: 100 })
        .then((res) => {
          if (isMounted) {
            setColonies(res.data);
          }
        })
        .catch(() => {
          // Graceful fallback if colonies cannot be loaded
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isPlatformAdmin, canRead]);

  // Execute fetch plots implementation
  const executeFetch = useCallback(
    async (
      targetPage: number,
      targetSearch: string,
      targetColony: string,
      targetStatus: string,
      targetRateType: string,
      targetActive: 'all' | 'true' | 'false'
    ) => {
      if (isPlatformAdmin || !canRead) {
        setIsLoading(false);
        return;
      }

      const currentRequestId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const res = await plotsApi.listPlots({
          page: targetPage,
          limit,
          search: targetSearch.trim() || undefined,
          colonyId: targetColony || undefined,
          status: targetStatus === 'all' ? undefined : (targetStatus as PlotStatus),
          rateType: targetRateType === 'all' ? undefined : (targetRateType as PlotRateType),
          isActive: targetActive === 'all' ? undefined : targetActive,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (currentRequestId === activeRequestIdRef.current) {
          setPlots(res.data);
          setMeta(res.meta || null);
        }
      } catch (err: unknown) {
        if (currentRequestId === activeRequestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch plots.');
        }
      } finally {
        if (currentRequestId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [isPlatformAdmin, canRead, limit]
  );

  // Synchronize listing on query/filter/page change
  useEffect(() => {
    let isMounted = true;

    async function sync() {
      // Yield to next microtask so setState is not invoked synchronously within effect render
      await Promise.resolve();
      if (isMounted) {
        void executeFetch(page, search, colonyFilter, statusFilter, rateTypeFilter, activeFilter);
      }
    }

    void sync();

    return () => {
      isMounted = false;
    };
  }, [page, search, colonyFilter, statusFilter, rateTypeFilter, activeFilter, executeFetch]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    void executeFetch(page, search, colonyFilter, statusFilter, rateTypeFilter, activeFilter);
  }, [executeFetch, page, search, colonyFilter, statusFilter, rateTypeFilter, activeFilter]);

  // Handle filter changes (resets pagination to page 1)
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleColonyFilterChange = (value: string) => {
    setColonyFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleRateTypeFilterChange = (value: string) => {
    setRateTypeFilter(value);
    setPage(1);
  };

  const handleActiveFilterChange = (value: 'all' | 'true' | 'false') => {
    setActiveFilter(value);
    setPage(1);
  };

  const handleCreateClick = () => {
    setSelectedPlotForEdit(null);
    setFormModalOpen(true);
  };

  const handleViewDetails = (plot: Plot) => {
    setSelectedPlotForDetails(plot);
    setDetailsModalOpen(true);
  };

  const handleEditClick = (plot: Plot) => {
    setSelectedPlotForEdit(plot);
    setFormModalOpen(true);
  };

  const handleDeactivateClick = (plot: Plot) => {
    setSelectedPlotForDeactivate(plot);
    setDeactivateModalOpen(true);
  };

  const handleWhatsAppShare = (plot: Plot) => {
    setSelectedPlotForWhatsApp(plot);
    setWhatsappModalOpen(true);
  };

  const handleViewPrivate = (plot: Plot) => {
    setSelectedPlotForPrivate(plot);
    setPrivateModalOpen(true);
  };

  const handleEditPrivateClick = (existingData: PlotPrivate | null) => {
    setInitialPrivateDataForEdit(existingData);
    setPrivateFormModalOpen(true);
  };

  const handleDeletePrivateClick = (existingData: PlotPrivate) => {
    setInitialPrivateDataForEdit(existingData);
    setDeletePrivateModalOpen(true);
  };

  const handlePrivateMutationSuccess = () => {
    setPrivateRefreshKey((k) => k + 1);
  };

  // SUPER_ADMIN boundary guard
  if (isPlatformAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Plot Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">Tenant real estate plot listing and inventory management.</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-6 text-center max-w-2xl mx-auto my-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-purple-900">Platform Administrator Restricted</h3>
          <p className="text-xs text-purple-700 mt-2 max-w-md mx-auto leading-relaxed">
            Super Administrators manage global system configuration and tenant firms. Direct access to firm-scoped
            plot inventory is restricted by multi-tenant architecture. Please sign in with an authorized Firm
            Administrator or Staff account.
          </p>
        </div>
      </div>
    );
  }

  // FIRM_STAFF missing plots:read permission
  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Plot Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">Tenant real estate plot listing and inventory management.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center max-w-lg mx-auto my-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-amber-900">Access Restricted</h3>
          <p className="text-xs text-amber-700 mt-2">
            Your user account does not have the required <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">plots:read</code> permission. Contact your firm administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Plot Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse, filter, and register public plot inventory and marketing specifications.
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleCreateClick} leftIcon={<Plus className="h-4 w-4" />}>
            Add Plot
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Input
              placeholder="Search by plot number, reference, or description..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              className="h-9"
            />
          </div>

          <div className="flex items-center gap-2">
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
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium">Filters:</span>
          </div>

          {/* Colony Filter */}
          <select
            value={colonyFilter}
            onChange={(e) => handleColonyFilterChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">All Colonies</option>
            {colonies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="on_hold">On Hold</option>
            <option value="sold">Sold</option>
          </select>

          {/* Rate Type Filter */}
          <select
            value={rateTypeFilter}
            onChange={(e) => handleRateTypeFilterChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">All Pricing Types</option>
            <option value="total">Lump Sum Total</option>
            <option value="per_unit">Per Unit Rate</option>
          </select>

          {/* Active / Inactive Filter */}
          <select
            value={activeFilter}
            onChange={(e) => handleActiveFilterChange(e.target.value as 'all' | 'true' | 'false')}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">Active & Inactive</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error state with retry */}
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
      ) : plots.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-6 w-6" />}
          title={
            search || colonyFilter || statusFilter !== 'all' || rateTypeFilter !== 'all' || activeFilter !== 'all'
              ? 'No matching plots found'
              : 'No plots registered yet'
          }
          description={
            search || colonyFilter || statusFilter !== 'all' || rateTypeFilter !== 'all' || activeFilter !== 'all'
              ? 'Try modifying your search query or filter options.'
              : 'Add your first real estate plot listing to start managing inventory.'
          }
          actionLabel={canWrite && !search && !colonyFilter && statusFilter === 'all' ? 'Register First Plot' : undefined}
          onAction={canWrite && !search && !colonyFilter && statusFilter === 'all' ? handleCreateClick : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plot Reference</TableHead>
                <TableHead>Colony</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Price / Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Plot Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plots.map((plot) => {
                const colony = plot.colonyId ? colonies.find((c) => c.id === plot.colonyId) : null;
                const hasVideo = Boolean(plot.videoUrl || plot.video?.url);

                return (
                  <TableRow key={plot.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{plot.plotRef || plot.plotId}</div>
                      {plot.description && (
                        <p className="text-[11px] text-slate-500 truncate max-w-xs">{plot.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-700">
                        {colony?.name || (plot.colonyId ? 'Assigned Colony' : 'Independent')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-slate-800">
                        {formatArea(plot.size, plot.sizeUnit)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-slate-800">
                        {formatPlotRate(plot.rate, plot.rateType, plot.sizeUnit, plot.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={plot.status} />
                    </TableCell>
                    <TableCell>
                      {hasVideo ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <Video className="h-3 w-3" />
                          <span>Video</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500">{formatDate(plot.plotDate)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetails(plot)}
                          aria-label={`View details of ${plot.plotRef}`}
                          className="h-8 w-8 p-0"
                          title="View public details"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleWhatsAppShare(plot)}
                          aria-label={`Share ${plot.plotRef} on WhatsApp`}
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          title="Share on WhatsApp"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M12.031 2C6.516 2 2.027 6.488 2.027 12c0 1.93.551 3.734 1.508 5.267L2 22l4.871-1.488A9.92 9.92 0 0 0 12.03 22c5.517 0 10.007-4.488 10.007-10s-4.49-10-10.006-10zm5.859 14.167c-.246.688-1.433 1.328-1.973 1.383-.51.055-1.168.082-3.375-.828-2.656-1.094-4.363-3.797-4.496-3.973-.133-.176-1.082-1.441-1.082-2.742 0-1.305.688-1.945.934-2.211.246-.266.535-.332.715-.332.179 0 .359 0 .515.012.168.012.395-.066.617.473.23.559.789 1.922.859 2.063.07.141.117.309.023.496-.094.188-.141.305-.281.473-.141.168-.297.375-.426.504-.145.145-.297.305-.129.594.168.289.746 1.234 1.602 1.996 1.102.98 2.031 1.285 2.32 1.426.289.141.457.121.625-.07.168-.191.719-.836.91-1.125.191-.289.383-.242.641-.148.258.094 1.637.773 1.918.914.281.141.469.211.539.328.07.117.07.68-.176 1.368z" />
                          </svg>
                        </Button>
                        {canReadPrivate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewPrivate(plot)}
                            aria-label={`View confidential details for ${plot.plotRef}`}
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                            title="View confidential owner & source"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(plot)}
                            aria-label={`Edit ${plot.plotRef}`}
                            className="h-8 w-8 p-0"
                            title="Edit plot"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeactivateClick(plot)}
                            aria-label={`Deactivate ${plot.plotRef}`}
                            className="h-8 w-8 p-0 hover:text-red-600"
                            title="Deactivate plot"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination Footer */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
              <div>
                Showing page <strong className="text-slate-900">{meta.page}</strong> of{' '}
                <strong className="text-slate-900">{meta.totalPages}</strong> ({meta.total} total plots)
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

      {/* Create / Edit Modal */}
      {formModalOpen && (
        <PlotFormModal
          key={selectedPlotForEdit?.id || 'new-plot'}
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          plot={selectedPlotForEdit}
          onSuccess={handleRefresh}
        />
      )}

      {/* Public Details Modal */}
      <PlotDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        plot={selectedPlotForDetails}
        colonies={colonies}
        onViewPrivateClick={handleViewPrivate}
        onShareWhatsAppClick={(plot) => {
          setDetailsModalOpen(false);
          handleWhatsAppShare(plot);
        }}
      />

      {/* Deactivate Modal */}
      {deactivateModalOpen && (
        <DeactivatePlotModal
          key={selectedPlotForDeactivate?.id || 'deactivate-plot'}
          open={deactivateModalOpen}
          onOpenChange={setDeactivateModalOpen}
          plot={selectedPlotForDeactivate}
          onSuccess={handleRefresh}
        />
      )}

      {/* Confidential Private Data View Modal */}
      {privateModalOpen && (
        <PlotPrivateModal
          key={`private-${selectedPlotForPrivate?.id}-${privateRefreshKey}`}
          open={privateModalOpen}
          onOpenChange={setPrivateModalOpen}
          plot={selectedPlotForPrivate}
          onEditClick={handleEditPrivateClick}
          onDeleteClick={handleDeletePrivateClick}
        />
      )}

      {/* Confidential Private Data Form Modal */}
      {privateFormModalOpen && (
        <PlotPrivateFormModal
          key={`form-${selectedPlotForPrivate?.id}-${initialPrivateDataForEdit?.id || 'new'}`}
          open={privateFormModalOpen}
          onOpenChange={setPrivateFormModalOpen}
          plot={selectedPlotForPrivate}
          initialData={initialPrivateDataForEdit}
          onSuccess={handlePrivateMutationSuccess}
        />
      )}

      {/* Confidential Private Data Deletion Modal */}
      {deletePrivateModalOpen && (
        <DeletePlotPrivateModal
          key={`delete-${selectedPlotForPrivate?.id}`}
          open={deletePrivateModalOpen}
          onOpenChange={setDeletePrivateModalOpen}
          plot={selectedPlotForPrivate}
          onSuccess={handlePrivateMutationSuccess}
        />
      )}

      {/* WhatsApp Share Modal */}
      {whatsappModalOpen && (
        <WhatsAppShareModal
          key={`whatsapp-${selectedPlotForWhatsApp?.id || 'share'}`}
          open={whatsappModalOpen}
          onOpenChange={setWhatsappModalOpen}
          plot={selectedPlotForWhatsApp}
        />
      )}
    </div>
  );
}

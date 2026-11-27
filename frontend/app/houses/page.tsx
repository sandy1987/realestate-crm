'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, isSuperAdmin } from '@/lib/utils/permissions';
import { plotsApi } from '@/lib/api/plots';
import { coloniesApi } from '@/lib/api/colonies';
import { firmUsersApi } from '@/lib/api/firmUsers';
import { Plot, PlotStatus } from '@/types/plot';
import { Colony } from '@/types/colony';
import { UserSummary } from '@/types/user';
import { PaginationMeta } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Loading';
import { HouseFormModal, HOUSE_TYPES, BHK_OPTIONS } from '@/components/houses/HouseFormModal';
import { HouseDetailsModal } from '@/components/houses/HouseDetailsModal';
import { DeactivatePlotModal } from '@/components/plots/DeactivatePlotModal';
import { WhatsAppShareModal } from '@/components/plots/WhatsAppShareModal';
import { PlotPrivateModal } from '@/components/plots/PlotPrivateModal';
import { PlotPrivateFormModal } from '@/components/plots/PlotPrivateFormModal';
import { DeletePlotPrivateModal } from '@/components/plots/DeletePlotPrivateModal';
import { PlotPrivate } from '@/types/plotPrivate';
import { formatPlotRate, formatDate } from '@/lib/utils/formatters';
import {
  Home,
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
  Share2,
  Building,
} from 'lucide-react';

const HOUSE_PRICE_RANGES = [
  { id: 'all', label: 'All Price Ranges' },
  { id: 'under_25l', label: 'Under ₹25 Lakh', min: 0, max: 2500000 },
  { id: '25l_50l', label: '₹25L – ₹50 Lakh', min: 2500000, max: 5000000 },
  { id: '50l_1cr', label: '₹50L – ₹1 Crore', min: 5000000, max: 10000000 },
  { id: '1cr_3cr', label: '₹1Cr – ₹3 Crore', min: 10000000, max: 30000000 },
  { id: 'above_3cr', label: 'Above ₹3 Crore', min: 30000000, max: undefined },
] as const;

export default function HousesPage() {
  const { user } = useAuth();

  const isPlatformAdmin = isSuperAdmin(user);
  const isFirmAdmin = user?.role === 'FIRM_ADMIN';
  const canRead = hasPermission(user, 'houses:read') || hasPermission(user, 'plots:read');
  const canWrite = hasPermission(user, 'houses:write') || hasPermission(user, 'plots:write');
  const canDelete = hasPermission(user, 'houses:delete') || hasPermission(user, 'plots:delete');
  const canReadPrivate = !isPlatformAdmin && hasPermission(user, 'private:read');

  const [properties, setProperties] = useState<Plot[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [advisors, setAdvisors] = useState<UserSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination state
  const [search, setSearch] = useState('');
  const [colonyFilter, setColonyFilter] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [houseTypeFilter, setHouseTypeFilter] = useState<string>('all');
  const [bhkFilter, setBhkFilter] = useState<string>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<Plot | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedForDetails, setSelectedForDetails] = useState<Plot | null>(null);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [selectedForDeactivate, setSelectedForDeactivate] = useState<Plot | null>(null);

  // WhatsApp share modal state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [selectedForWhatsApp, setSelectedForWhatsApp] = useState<Plot | null>(null);

  // Private owner modal states
  const [privateModalOpen, setPrivateModalOpen] = useState(false);
  const [selectedForPrivate, setSelectedForPrivate] = useState<Plot | null>(null);
  const [privateFormModalOpen, setPrivateFormModalOpen] = useState(false);
  const [initialPrivateDataForEdit, setInitialPrivateDataForEdit] = useState<PlotPrivate | null>(null);
  const [deletePrivateModalOpen, setDeletePrivateModalOpen] = useState(false);

  const activeRequestIdRef = useRef(0);

  // Fetch colonies on mount
  useEffect(() => {
    let isMounted = true;

    if (canRead && !isPlatformAdmin) {
      coloniesApi
        .listColonies({ limit: 100, sortBy: 'name', sortOrder: 'asc' })
        .then((res) => {
          if (isMounted) setColonies(res.data);
        })
        .catch(() => {});

      if (isFirmAdmin) {
        firmUsersApi
          .listStaff({ limit: 100 })
          .then((res) => {
            if (isMounted) setAdvisors(res.data);
          })
          .catch(() => {});
      }
    }

    return () => {
      isMounted = false;
    };
  }, [canRead, isPlatformAdmin, isFirmAdmin]);

  const executeFetch = useCallback(
    async (
      targetPage: number,
      targetSearch: string,
      targetColony: string,
      targetAdvisor: string,
      targetStatus: string,
      targetHouseType: string,
      targetBhk: string,
      targetPriceRange: string
    ) => {
      const currentRequestId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const selectedRange = HOUSE_PRICE_RANGES.find((r) => r.id === targetPriceRange);

        const res = await plotsApi.listPlots({
          page: targetPage,
          limit,
          search: targetSearch.trim() || undefined,
          colonyId: targetColony || undefined,
          advisorId: targetAdvisor || undefined,
          status: targetStatus === 'all' ? undefined : (targetStatus as PlotStatus),
          category: 'house',
          houseType: targetHouseType === 'all' ? undefined : targetHouseType,
          bhk: targetBhk === 'all' ? undefined : targetBhk,
          rateMin: selectedRange && 'min' in selectedRange ? (selectedRange as any).min : undefined,
          rateMax: selectedRange && 'max' in selectedRange ? (selectedRange as any).max : undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (currentRequestId === activeRequestIdRef.current) {
          setProperties(res.data);
          setMeta(res.meta || null);
        }
      } catch (err: unknown) {
        if (currentRequestId === activeRequestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch house and flat listings.');
        }
      } finally {
        if (currentRequestId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [limit]
  );

  useEffect(() => {
    let isMounted = true;

    async function sync() {
      await Promise.resolve();
      if (isMounted && canRead && !isPlatformAdmin) {
        void executeFetch(
          page,
          search,
          colonyFilter,
          advisorFilter,
          statusFilter,
          houseTypeFilter,
          bhkFilter,
          priceRangeFilter
        );
      }
    }

    void sync();

    return () => {
      isMounted = false;
    };
  }, [
    page,
    search,
    colonyFilter,
    advisorFilter,
    statusFilter,
    houseTypeFilter,
    bhkFilter,
    priceRangeFilter,
    executeFetch,
    canRead,
    isPlatformAdmin,
  ]);

  const handleRefresh = () => {
    void executeFetch(
      page,
      search,
      colonyFilter,
      advisorFilter,
      statusFilter,
      houseTypeFilter,
      bhkFilter,
      priceRangeFilter
    );
  };

  const handleCreateClick = () => {
    setSelectedForEdit(null);
    setFormModalOpen(true);
  };

  const handleEditClick = (prop: Plot) => {
    setSelectedForEdit(prop);
    setFormModalOpen(true);
  };

  const handleViewDetails = (prop: Plot) => {
    setSelectedForDetails(prop);
    setDetailsModalOpen(true);
  };

  const handleDeactivateClick = (prop: Plot) => {
    setSelectedForDeactivate(prop);
    setDeactivateModalOpen(true);
  };

  const handleWhatsAppClick = (prop: Plot) => {
    setSelectedForWhatsApp(prop);
    setWhatsappModalOpen(true);
  };

  const handleViewPrivate = (prop: Plot) => {
    setSelectedForPrivate(prop);
    setPrivateModalOpen(true);
  };

  const handleOpenPrivateForm = (existingData: PlotPrivate | null) => {
    setInitialPrivateDataForEdit(existingData);
    setPrivateFormModalOpen(true);
  };

  const handleOpenDeletePrivate = (prop: Plot) => {
    setSelectedForPrivate(prop);
    setDeletePrivateModalOpen(true);
  };

  if (isPlatformAdmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
          <div>
            <h2 className="text-base font-semibold">Platform Administrator View</h2>
            <p className="text-xs text-amber-700 mt-1">
              Super Administrators manage tenant firms and system-wide settings. Direct property inventory is
              strictly scoped to tenant broker firms.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
          <div>
            <h2 className="text-base font-semibold">Access Denied</h2>
            <p className="text-xs text-red-700 mt-1">
              You do not have permission to view residential properties. Contact your firm administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Houses &amp; Flats</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              Residential Sale
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage ready-to-move houses, independent kothis, villas, and society flats for sale.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-9 gap-1.5"
            title="Refresh listing"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {canWrite && (
            <Button size="sm" onClick={handleCreateClick} leftIcon={<Plus className="h-4 w-4" />}>
              Add House / Flat
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search house no, society, BHK, or keywords..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Subtype Filter */}
        <select
          value={houseTypeFilter}
          onChange={(e) => {
            setHouseTypeFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Sub-Types</option>
          {HOUSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* BHK Filter */}
        <select
          value={bhkFilter}
          onChange={(e) => {
            setBhkFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All BHKs</option>
          {BHK_OPTIONS.map((bhk) => (
            <option key={bhk} value={bhk}>
              {bhk}
            </option>
          ))}
        </select>

        {/* Price Range Presets */}
        <select
          value={priceRangeFilter}
          onChange={(e) => {
            setPriceRangeFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        >
          {HOUSE_PRICE_RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        {/* Colony Filter */}
        <select
          value={colonyFilter}
          onChange={(e) => {
            setColonyFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Colonies / Sectors</option>
          {colonies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Advisor Filter (Firm Admin Only) */}
        {isFirmAdmin && (
          <select
            value={advisorFilter}
            onChange={(e) => {
              setAdvisorFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">All Advisors</option>
            {advisors.map((adv) => (
              <option key={adv.id} value={adv.id}>
                {adv.name}
              </option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
          <option value="on_hold">On Hold</option>
        </select>

        {/* Clear Filters Button */}
        {(search ||
          colonyFilter ||
          advisorFilter ||
          statusFilter !== 'all' ||
          houseTypeFilter !== 'all' ||
          bhkFilter !== 'all' ||
          priceRangeFilter !== 'all') && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setColonyFilter('');
              setAdvisorFilter('');
              setStatusFilter('all');
              setHouseTypeFilter('all');
              setBhkFilter('all');
              setPriceRangeFilter('all');
              setPage(1);
            }}
            className="h-8 text-xs text-slate-500 hover:text-slate-800"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Main Table / Content */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</div>
      ) : properties.length === 0 ? (
        <EmptyState
          icon={<Home className="h-6 w-6" />}
          title={search ? 'No matching houses or flats found' : 'No houses or flats registered yet'}
          description={
            search
              ? 'Try adjusting your search criteria or clearing filter filters.'
              : 'Add your first ready-made house, villa, or flat listing with photos and video tour.'
          }
          actionLabel={canWrite && !search ? 'Add First House / Flat' : undefined}
          onAction={canWrite && !search ? handleCreateClick : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property Ref</TableHead>
                <TableHead>Type &amp; BHK</TableHead>
                <TableHead>Location / Society</TableHead>
                <TableHead>Size &amp; Floor</TableHead>
                <TableHead>Total Sale Price</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((prop) => {
                const colony = prop.colonyId ? colonies.find((c) => c.id === prop.colonyId) : null;
                const hasVideo = Boolean(prop.videoUrl || prop.video?.url);

                return (
                  <TableRow key={prop.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{prop.plotRef || prop.plotId}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">ID: {prop.id}</span>
                        {hasVideo && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded font-medium">
                            <Video className="h-2.5 w-2.5" />
                            Tour
                          </span>
                        )}
                        {prop.images && prop.images.length > 0 && (
                          <span className="text-[9px] text-slate-400">({prop.images.length} photos)</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-semibold text-slate-800">{prop.bhk || '—'}</div>
                      <span className="text-[11px] text-slate-500">{prop.houseType || 'House / Flat'}</span>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-800 font-medium">
                        {prop.societyName ? prop.societyName : colony ? colony.name : 'Independent'}
                      </div>
                      {prop.societyName && colony && (
                        <div className="text-[11px] text-slate-400">{colony.name}</div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-medium text-slate-800">
                        {prop.size ? `${Number(prop.size).toLocaleString('en-IN')} ${prop.sizeUnit || 'sqft'}` : '—'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {prop.floorNo ? prop.floorNo : prop.plotArea ? `Plot: ${prop.plotArea} sqyd` : '—'}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-slate-800 text-xs">
                        {formatPlotRate(prop.rate, 'total', prop.sizeUnit, prop.currency)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-600 font-medium">
                        {prop.creator?.name || 'Staff'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={prop.status} />
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* WhatsApp Share Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleWhatsAppClick(prop)}
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="Share via WhatsApp"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>

                        {/* View Details */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetails(prop)}
                          className="h-8 w-8 p-0"
                          title="View property details"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600" />
                        </Button>

                        {/* Private Owner Contact Info */}
                        {canReadPrivate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewPrivate(prop)}
                            className="h-8 w-8 p-0 hover:text-amber-600"
                            title="Confidential House / Flat Owner details"
                          >
                            <Lock className="h-3.5 w-3.5 text-amber-500" />
                          </Button>
                        )}

                        {/* Edit Button */}
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(prop)}
                            className="h-8 w-8 p-0 hover:text-blue-600"
                            title="Edit house/flat"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                          </Button>
                        )}

                        {/* Deactivate Button */}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeactivateClick(prop)}
                            className="h-8 w-8 p-0 hover:text-red-600"
                            title="Deactivate listing"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-slate-400" />
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
                <strong className="text-slate-900">{meta.totalPages}</strong> ({meta.total} properties)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 text-xs"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {formModalOpen && (
        <HouseFormModal
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          plot={selectedForEdit}
          onSuccess={handleRefresh}
        />
      )}

      {detailsModalOpen && (
        <HouseDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          plot={selectedForDetails}
          colonies={colonies}
          onViewPrivateClick={handleViewPrivate}
          onShareWhatsAppClick={handleWhatsAppClick}
        />
      )}

      {deactivateModalOpen && (
        <DeactivatePlotModal
          open={deactivateModalOpen}
          onOpenChange={setDeactivateModalOpen}
          plot={selectedForDeactivate}
          onSuccess={handleRefresh}
        />
      )}

      {whatsappModalOpen && (
        <WhatsAppShareModal
          open={whatsappModalOpen}
          onOpenChange={setWhatsappModalOpen}
          plot={selectedForWhatsApp}
        />
      )}

      {/* Private Details Inspection Modal */}
      {privateModalOpen && (
        <PlotPrivateModal
          open={privateModalOpen}
          onOpenChange={setPrivateModalOpen}
          plot={selectedForPrivate}
          onEditClick={handleOpenPrivateForm}
          onDeleteClick={() => setDeletePrivateModalOpen(true)}
        />
      )}

      {/* Private Details Create/Edit Form Modal */}
      {privateFormModalOpen && (
        <PlotPrivateFormModal
          open={privateFormModalOpen}
          onOpenChange={setPrivateFormModalOpen}
          plot={selectedForPrivate}
          initialData={initialPrivateDataForEdit}
          onSuccess={handleRefresh}
        />
      )}

      {/* Private Details Deletion Modal */}
      {deletePrivateModalOpen && (
        <DeletePlotPrivateModal
          open={deletePrivateModalOpen}
          onOpenChange={setDeletePrivateModalOpen}
          plot={selectedForPrivate}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}


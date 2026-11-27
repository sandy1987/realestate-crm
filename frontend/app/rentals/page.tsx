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
import { RentalFormModal } from '@/components/rentals/RentalFormModal';
import { RentalDetailsModal } from '@/components/rentals/RentalDetailsModal';
import { DeactivatePlotModal } from '@/components/plots/DeactivatePlotModal';
import { WhatsAppShareModal } from '@/components/plots/WhatsAppShareModal';
import { PlotPrivateModal } from '@/components/plots/PlotPrivateModal';
import { PlotPrivateFormModal } from '@/components/plots/PlotPrivateFormModal';
import { DeletePlotPrivateModal } from '@/components/plots/DeletePlotPrivateModal';
import { PlotPrivate } from '@/types/plotPrivate';
import { formatArea, formatPlotRate, formatCurrency, formatDate } from '@/lib/utils/formatters';
import {
  KeyRound,
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
} from 'lucide-react';

const RENTAL_PRICE_RANGES = [
  { id: 'all', label: 'All Rents' },
  { id: 'under_10k', label: 'Under ₹10,000 / mo', min: 0, max: 10000 },
  { id: '10k_25k', label: '₹10,000 – ₹25,000 / mo', min: 10000, max: 25000 },
  { id: '25k_50k', label: '₹25,000 – ₹50,000 / mo', min: 25000, max: 50000 },
  { id: '50k_1l', label: '₹50,000 – ₹1 Lakh / mo', min: 50000, max: 100000 },
  { id: 'above_1l', label: 'Above ₹1 Lakh / mo', min: 100000, max: undefined },
] as const;

export default function RentalsPage() {
  const { user } = useAuth();

  const isPlatformAdmin = isSuperAdmin(user);
  const isFirmAdmin = user?.role === 'FIRM_ADMIN';
  const canRead = hasPermission(user, 'rentals:read') || hasPermission(user, 'plots:read');
  const canWrite = hasPermission(user, 'rentals:write') || hasPermission(user, 'plots:write');
  const canDelete = hasPermission(user, 'rentals:delete') || hasPermission(user, 'plots:delete');
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
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');
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

  // Private owner/source modal states
  const [privateModalOpen, setPrivateModalOpen] = useState(false);
  const [selectedForPrivate, setSelectedForPrivate] = useState<Plot | null>(null);
  const [privateFormModalOpen, setPrivateFormModalOpen] = useState(false);
  const [initialPrivateDataForEdit, setInitialPrivateDataForEdit] = useState<PlotPrivate | null>(null);
  const [deletePrivateModalOpen, setDeletePrivateModalOpen] = useState(false);

  const activeRequestIdRef = useRef(0);

  // Load colonies & advisors asynchronously
  useEffect(() => {
    let isMounted = true;
    if (!isPlatformAdmin && canRead) {
      coloniesApi
        .listColonies({ limit: 100 })
        .then((res) => {
          if (isMounted) setColonies(res.data);
        })
        .catch(() => {});
    }

    if (isFirmAdmin) {
      firmUsersApi
        .listStaff({ limit: 100 })
        .then((res) => {
          if (isMounted) setAdvisors(res.data);
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [isPlatformAdmin, canRead, isFirmAdmin]);

  const executeFetch = useCallback(
    async (
      targetPage: number,
      targetSearch: string,
      targetColony: string,
      targetAdvisor: string,
      targetStatus: string,
      targetPropertyType: string,
      targetPriceRange: string
    ) => {
      if (isPlatformAdmin || !canRead) {
        setIsLoading(false);
        return;
      }

      const currentRequestId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setError(null);

      const selectedRange = RENTAL_PRICE_RANGES.find((r) => r.id === targetPriceRange);

      try {
        const res = await plotsApi.listPlots({
          page: targetPage,
          limit,
          category: 'rental',
          search: targetSearch.trim() || undefined,
          colonyId: targetColony || undefined,
          advisorId: targetAdvisor || undefined,
          status: targetStatus === 'all' ? undefined : (targetStatus as PlotStatus),
          rentalType: targetPropertyType === 'all' ? undefined : targetPropertyType,
          rateMin: selectedRange && 'min' in selectedRange ? selectedRange.min : undefined,
          rateMax: selectedRange && 'max' in selectedRange ? selectedRange.max : undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (currentRequestId === activeRequestIdRef.current) {
          setProperties(res.data);
          setMeta(res.meta || null);
        }
      } catch (err: unknown) {
        if (currentRequestId === activeRequestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch rental properties.');
        }
      } finally {
        if (currentRequestId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [isPlatformAdmin, canRead, limit]
  );

  useEffect(() => {
    let isMounted = true;
    async function sync() {
      await Promise.resolve();
      if (isMounted) {
        void executeFetch(page, search, colonyFilter, advisorFilter, statusFilter, propertyTypeFilter, priceRangeFilter);
      }
    }
    void sync();
    return () => {
      isMounted = false;
    };
  }, [page, search, colonyFilter, advisorFilter, statusFilter, propertyTypeFilter, priceRangeFilter, executeFetch]);

  const handleRefresh = useCallback(() => {
    void executeFetch(page, search, colonyFilter, advisorFilter, statusFilter, propertyTypeFilter, priceRangeFilter);
  }, [executeFetch, page, search, colonyFilter, advisorFilter, statusFilter, propertyTypeFilter, priceRangeFilter]);

  if (isPlatformAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Rental Properties</h1>
          <p className="text-xs text-slate-500 mt-1">Tenant rental property listings and lease inventory.</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-6 text-center max-w-2xl mx-auto my-12">
          <ShieldAlert className="h-6 w-6 text-purple-700 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-purple-900">Platform Administrator Restricted</h3>
          <p className="text-xs text-purple-700 mt-2">
            Super Administrators manage global platform operations. Direct access to firm rental inventory is scoped to firm members.
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Rental Properties</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              For Rent / Lease
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isFirmAdmin
              ? 'Manage all residential, commercial, and land rental listings across all advisors.'
              : 'Browse, register, and manage your assigned rental property listings.'}
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setSelectedForEdit(null);
              setFormModalOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Rental Property
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Input
              placeholder="Search by rental code, location, or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium">Filters:</span>
          </div>

          {/* Colony Filter */}
          <select
            value={colonyFilter}
            onChange={(e) => {
              setColonyFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
          >
            <option value="">All Locations / Colonies</option>
            {colonies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Advisor Filter (Admin only) */}
          {isFirmAdmin && advisors.length > 0 && (
            <select
              value={advisorFilter}
              onChange={(e) => {
                setAdvisorFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value="">All Advisors</option>
              {advisors.map((adv) => {
                const advName = [adv.firstName, adv.lastName].filter(Boolean).join(' ') || adv.email;
                return (
                  <option key={adv.id} value={adv.id}>
                    {advName}
                  </option>
                );
              })}
            </select>
          )}

          {/* Property Type Filter */}
          <select
            value={propertyTypeFilter}
            onChange={(e) => {
              setPropertyTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
          >
            <option value="all">All Rental Types</option>
            <option value="Residential Flat / Apartment">Residential Flat</option>
            <option value="Independent House / Villa">House / Villa</option>
            <option value="Commercial Shop">Commercial Shop</option>
            <option value="Office Space">Office Space</option>
            <option value="Warehouse / Godown">Warehouse</option>
            <option value="Open Land / Plot on Lease">Land on Lease</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="on_hold">On Hold</option>
            <option value="sold">Rented Out</option>
          </select>

          {/* Price / Rent Filter */}
          <select
            value={priceRangeFilter}
            onChange={(e) => {
              setPriceRangeFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
          >
            {RENTAL_PRICE_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="h-6 w-6 text-emerald-600" />}
          title="No rental properties listed"
          description="Register your first residential, commercial, or lease rental property to start managing tenant inventory."
          actionLabel={canWrite ? 'List First Rental Property' : undefined}
          onAction={
            canWrite
              ? () => {
                  setSelectedForEdit(null);
                  setFormModalOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Monthly Rent</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Size / Area</TableHead>
                <TableHead>Furnishing</TableHead>
                <TableHead>Status</TableHead>
                {isFirmAdmin && <TableHead>Advisor</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((p) => {
                const colony = p.colonyId ? colonies.find((c) => c.id === p.colonyId) : null;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{p.plotRef || p.plotId}</div>
                      <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                        {colony?.name || 'Independent Location'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs font-medium text-slate-800">
                        {p.rentalType || 'Residential / Commercial'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs font-bold text-emerald-700">
                        {formatPlotRate(p.rate, 'total', p.sizeUnit, p.currency)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-600">
                        {p.securityDeposit ? formatCurrency(p.securityDeposit, p.currency) : '—'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-800 font-medium">{formatArea(p.size, p.sizeUnit)}</span>
                      {p.dimensions && <span className="text-[10px] text-slate-400 block">{p.dimensions}</span>}
                    </TableCell>

                    <TableCell>
                      <span className="text-xs capitalize text-slate-600">
                        {p.furnishing ? p.furnishing.replace('_', ' ') : 'Unspecified'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>

                    {isFirmAdmin && (
                      <TableCell>
                        {p.creator ? (
                          <div>
                            <span className="text-xs font-semibold text-slate-800 block">{p.creator.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">{p.creator.email}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Admin</span>
                        )}
                      </TableCell>
                    )}

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedForDetails(p);
                            setDetailsModalOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                          title="View property details"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600" />
                        </Button>

                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedForEdit(p);
                              setFormModalOpen(true);
                            }}
                            className="h-8 w-8 p-0"
                            title="Edit rental property"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedForWhatsApp(p);
                            setWhatsappModalOpen(true);
                          }}
                          className="h-8 w-8 p-0 hover:text-emerald-600"
                          title="Share on WhatsApp"
                        >
                          <Share2 className="h-3.5 w-3.5 text-slate-600" />
                        </Button>

                        {canReadPrivate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedForPrivate(p);
                              setPrivateModalOpen(true);
                            }}
                            className="h-8 w-8 p-0 hover:text-amber-600"
                            title="Confidential Rental Owner details"
                          >
                            <Lock className="h-3.5 w-3.5 text-amber-500" />
                          </Button>
                        )}

                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedForDeactivate(p);
                              setDeactivateModalOpen(true);
                            }}
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

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
              <div>
                Showing page <strong className="text-slate-900">{meta.page}</strong> of{' '}
                <strong className="text-slate-900">{meta.totalPages}</strong> ({meta.total} total rentals)
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

      {/* Modals */}
      {formModalOpen && (
        <RentalFormModal
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          plot={selectedForEdit}
          onSuccess={handleRefresh}
        />
      )}

      {detailsModalOpen && (
        <RentalDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          plot={selectedForDetails}
          colonies={colonies}
          onViewPrivateClick={(p) => {
            setDetailsModalOpen(false);
            setSelectedForPrivate(p);
            setPrivateModalOpen(true);
          }}
          onShareWhatsAppClick={(p) => {
            setDetailsModalOpen(false);
            setSelectedForWhatsApp(p);
            setWhatsappModalOpen(true);
          }}
        />
      )}

      {whatsappModalOpen && (
        <WhatsAppShareModal
          open={whatsappModalOpen}
          onOpenChange={setWhatsappModalOpen}
          plot={selectedForWhatsApp}
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

      {privateModalOpen && selectedForPrivate && (
        <PlotPrivateModal
          open={privateModalOpen}
          onOpenChange={setPrivateModalOpen}
          plot={selectedForPrivate}
          onEditClick={(existingData) => {
            setInitialPrivateDataForEdit(existingData);
            setPrivateFormModalOpen(true);
          }}
          onDeleteClick={() => {
            setDeletePrivateModalOpen(true);
          }}
        />
      )}

      {privateFormModalOpen && selectedForPrivate && (
        <PlotPrivateFormModal
          open={privateFormModalOpen}
          onOpenChange={setPrivateFormModalOpen}
          plot={selectedForPrivate}
          initialData={initialPrivateDataForEdit}
          onSuccess={() => {}}
        />
      )}

      {deletePrivateModalOpen && selectedForPrivate && (
        <DeletePlotPrivateModal
          open={deletePrivateModalOpen}
          onOpenChange={setDeletePrivateModalOpen}
          plot={selectedForPrivate}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}


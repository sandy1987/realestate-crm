'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, isSuperAdmin } from '@/lib/utils/permissions';
import { coloniesApi } from '@/lib/api/colonies';
import { Colony } from '@/types/colony';
import { PaginationMeta } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Loading';
import { ColonyFormModal } from '@/components/colonies/ColonyFormModal';
import { DeactivateColonyModal } from '@/components/colonies/DeactivateColonyModal';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { formatDate } from '@/lib/utils/formatters';
import {
  MapPin,
  Plus,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
} from 'lucide-react';

export default function ColoniesPage() {
  const { user } = useAuth();

  const isPlatformAdmin = isSuperAdmin(user);
  const canRead = hasPermission(user, 'colonies:read');
  const canWrite = hasPermission(user, 'colonies:write');

  const [colonies, setColonies] = useState<Colony[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination state
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedColonyForEdit, setSelectedColonyForEdit] = useState<Colony | null>(null);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [selectedColonyForDeactivate, setSelectedColonyForDeactivate] = useState<Colony | null>(null);
  const [viewingMapColony, setViewingMapColony] = useState<Colony | null>(null);

  // Stale request guard
  const activeRequestIdRef = useRef(0);

  // Fetch colonies implementation
  const executeFetch = useCallback(
    async (targetPage: number, targetSearch: string, targetActive: 'all' | 'true' | 'false') => {
      if (isPlatformAdmin || !canRead) {
        setIsLoading(false);
        return;
      }

      const currentRequestId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const res = await coloniesApi.listColonies({
          page: targetPage,
          limit,
          search: targetSearch.trim() || undefined,
          isActive: targetActive === 'all' ? undefined : targetActive,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (currentRequestId === activeRequestIdRef.current) {
          setColonies(res.data);
          setMeta(res.meta || null);
        }
      } catch (err: unknown) {
        if (currentRequestId === activeRequestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch colonies.');
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
        void executeFetch(page, search, activeFilter);
      }
    }

    void sync();

    return () => {
      isMounted = false;
    };
  }, [page, search, activeFilter, executeFetch]);

  // Refresh handler for manual refresh and modal callbacks
  const handleRefresh = useCallback(() => {
    void executeFetch(page, search, activeFilter);
  }, [executeFetch, page, search, activeFilter]);

  // Handle search submit or filter change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleActiveFilterChange = (value: 'all' | 'true' | 'false') => {
    setActiveFilter(value);
    setPage(1);
  };

  const handleCreateClick = () => {
    setSelectedColonyForEdit(null);
    setFormModalOpen(true);
  };

  const handleEditClick = (colony: Colony) => {
    setSelectedColonyForEdit(colony);
    setFormModalOpen(true);
  };

  const handleDeactivateClick = (colony: Colony) => {
    setSelectedColonyForDeactivate(colony);
    setDeactivateModalOpen(true);
  };

  // SUPER_ADMIN boundary guard
  if (isPlatformAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Colony Management</h1>
          <p className="text-xs text-slate-500 mt-1">Tenant development and sector boundary administration.</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-6 text-center max-w-2xl mx-auto my-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-purple-900">Platform Administrator Restricted</h3>
          <p className="text-xs text-purple-700 mt-2 max-w-md mx-auto leading-relaxed">
            Super Administrators manage global system settings and tenant firms. Direct access to firm-scoped colony
            data is restricted by multi-tenant architecture. Please switch to or log in with an authorized Firm
            Administrator or Staff account.
          </p>
        </div>
      </div>
    );
  }

  // FIRM_STAFF missing colonies:read permission
  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Colony Management</h1>
          <p className="text-xs text-slate-500 mt-1">Tenant development and sector boundary administration.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center max-w-lg mx-auto my-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-amber-900">Access Restricted</h3>
          <p className="text-xs text-amber-700 mt-2">
            Your user account does not have the required <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">colonies:read</code> permission. Contact your firm administrator to request access.
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Colony Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Register, configure, and inspect colony developments and sector boundaries for your firm.
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleCreateClick} leftIcon={<Plus className="h-4 w-4" />}>
            Add Colony
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search by name, city, state, or address..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="h-9"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium">Status:</span>
          </div>
          <select
            value={activeFilter}
            onChange={(e) => handleActiveFilterChange(e.target.value as 'all' | 'true' | 'false')}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="all">All Colonies</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>

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
      ) : colonies.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title={search || activeFilter !== 'all' ? 'No matching colonies found' : 'No colonies registered yet'}
          description={
            search || activeFilter !== 'all'
              ? 'Try modifying your search or filter criteria.'
              : 'Add your first colony development project to start listing plots.'
          }
          actionLabel={canWrite && !search && activeFilter === 'all' ? 'Create First Colony' : undefined}
          onAction={canWrite && !search && activeFilter === 'all' ? handleCreateClick : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colony Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Pincode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created Date</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {colonies.map((colony) => (
                <TableRow key={colony.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{colony.name}</span>
                      {colony.mapImageUrl && (
                        <button
                          type="button"
                          onClick={() => setViewingMapColony(colony)}
                          className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                          title="View Colony Layout Blueprint Map"
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          <span>Map</span>
                        </button>
                      )}
                    </div>
                    {colony.description && (
                      <p className="text-[11px] text-slate-500 truncate max-w-xs">{colony.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-700">
                      {[colony.city, colony.state].filter(Boolean).join(', ') || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-600 font-mono">{colony.pincode || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={colony.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">{formatDate(colony.createdAt)}</span>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {colony.mapImageUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingMapColony(colony)}
                            aria-label={`View Map for ${colony.name}`}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                            title="View Layout Blueprint"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClick(colony)}
                          aria-label={`Edit ${colony.name}`}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeactivateClick(colony)}
                          aria-label={`Deactivate ${colony.name}`}
                          className="h-8 w-8 p-0 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Footer */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
              <div>
                Showing page <strong className="text-slate-900">{meta.page}</strong> of{' '}
                <strong className="text-slate-900">{meta.totalPages}</strong> ({meta.total} total colonies)
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
        <ColonyFormModal
          key={selectedColonyForEdit?.id || 'new-colony'}
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          colony={selectedColonyForEdit}
          onSuccess={handleRefresh}
        />
      )}

      {/* Deactivate Modal */}
      {deactivateModalOpen && (
        <DeactivateColonyModal
          key={selectedColonyForDeactivate?.id || 'deactivate-colony'}
          open={deactivateModalOpen}
          onOpenChange={setDeactivateModalOpen}
          colony={selectedColonyForDeactivate}
          onSuccess={handleRefresh}
        />
      )}

      {/* Colony Layout Map Lightbox */}
      {viewingMapColony && viewingMapColony.mapImageUrl && (
        <Dialog open={Boolean(viewingMapColony)} onOpenChange={() => setViewingMapColony(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <span>{viewingMapColony.name} — Layout Map</span>
            </DialogTitle>
            <DialogDescription>
              Colony layout blueprint and sector boundary naksha ({viewingMapColony.city ? `${viewingMapColony.city}, ` : ''}{viewingMapColony.state || 'India'})
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewingMapColony.mapImageUrl}
              alt={`${viewingMapColony.name} Layout Map`}
              className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow-xs"
            />
          </div>

          <DialogFooter>
            <a
              href={viewingMapColony.mapImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
              <span>Open Full Resolution</span>
            </a>
            <Button variant="outline" onClick={() => setViewingMapColony(null)}>
              Close
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}

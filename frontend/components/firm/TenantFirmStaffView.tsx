'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { firmUsersApi } from '@/lib/api/firmUsers';
import { UserSummary } from '@/types/user';
import { PaginationMeta } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Loading';
import { FirmProfileCard } from './FirmProfileCard';
import { CreateStaffModal } from './CreateStaffModal';
import { EditStaffModal } from './EditStaffModal';
import { StaffStatusModal } from './StaffStatusModal';
import { StaffDetailsModal } from './StaffDetailsModal';
import { formatDate } from '@/lib/utils/formatters';
import {
  Users,
  Plus,
  Search,
  RotateCw,
  Eye,
  Edit2,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export interface TenantFirmStaffViewProps {
  readOnly?: boolean;
}

export function TenantFirmStaffView({ readOnly = false }: TenantFirmStaffViewProps) {
  const { user: currentUser } = useAuth();

  const [staffList, setStaffList] = useState<UserSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(!readOnly);
  const [error, setError] = useState<string | null>(null);

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'FIRM_ADMIN' | 'FIRM_STAFF'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<UserSummary | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserSummary | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<UserSummary | null>(null);
  const [statusMode, setStatusMode] = useState<'suspend' | 'activate'>('suspend');

  const activeRequestIdRef = useRef(0);

  const executeFetch = useCallback(
    async (
      targetPage: number,
      targetSearch: string,
      targetRole: 'all' | 'FIRM_ADMIN' | 'FIRM_STAFF',
      targetStatus: 'all' | 'active' | 'suspended'
    ) => {
      if (readOnly) return;

      const currentRequestId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const res = await firmUsersApi.listStaff({
          page: targetPage,
          limit,
          search: targetSearch.trim() || undefined,
          role: targetRole === 'all' ? undefined : targetRole,
          isSuspended: targetStatus === 'all' ? undefined : targetStatus === 'suspended',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (currentRequestId === activeRequestIdRef.current) {
          setStaffList(res.data);
          setMeta(res.meta || null);
        }
      } catch (err: unknown) {
        if (currentRequestId === activeRequestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch firm staff accounts.');
        }
      } finally {
        if (currentRequestId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [readOnly, limit]
  );

  // Synchronize on search / filter / page
  useEffect(() => {
    let isMounted = true;

    async function sync() {
      await Promise.resolve();
      if (isMounted && !readOnly) {
        void executeFetch(page, search, roleFilter, statusFilter);
      }
    }

    void sync();

    return () => {
      isMounted = false;
    };
  }, [page, search, roleFilter, statusFilter, readOnly, executeFetch]);

  const handleRefresh = useCallback(() => {
    void executeFetch(page, search, roleFilter, statusFilter);
  }, [executeFetch, page, search, roleFilter, statusFilter]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleRoleFilterChange = (val: 'all' | 'FIRM_ADMIN' | 'FIRM_STAFF') => {
    setRoleFilter(val);
    setPage(1);
  };

  const handleStatusFilterChange = (val: 'all' | 'active' | 'suspended') => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleViewDetails = (staff: UserSummary) => {
    setSelectedUserForDetails(staff);
    setDetailsModalOpen(true);
  };

  const handleEditClick = (staff: UserSummary) => {
    setSelectedUserForEdit(staff);
    setEditModalOpen(true);
  };

  const handleStatusClick = (staff: UserSummary, mode: 'suspend' | 'activate') => {
    setSelectedUserForStatus(staff);
    setStatusMode(mode);
    setStatusModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Current Firm Profile Card */}
      <FirmProfileCard />

      {/* Staff Management Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Firm Staff & User Directory</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Tenant Administration
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Administer team member accounts, assign granular role permissions, and control access statuses.
            </p>
          </div>
          {!readOnly && (
            <Button onClick={() => setCreateModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Add Staff Member
            </Button>
          )}
        </div>

        {readOnly ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center max-w-lg mx-auto my-6">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600 mb-2.5">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Staff Management Restricted</h3>
            <p className="text-xs text-slate-500 mt-1">
              Only firm administrators can create, update, or suspend staff accounts within your organization.
            </p>
          </div>
        ) : (
          <>
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="relative flex-1 max-w-md">
                <Input
                  placeholder="Search staff by email, first name, or last name..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  className="h-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Filter className="h-3.5 w-3.5" />
                  <span className="font-medium">Filter:</span>
                </div>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => handleRoleFilterChange(e.target.value as 'all' | 'FIRM_ADMIN' | 'FIRM_STAFF')}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="all">All Roles</option>
                  <option value="FIRM_ADMIN">Firm Admin</option>
                  <option value="FIRM_STAFF">Firm Staff</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value as 'all' | 'active' | 'suspended')}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="suspended">Suspended Only</option>
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

            {/* Error state */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
                <span>{error}</span>
                <Button size="sm" variant="outline" onClick={handleRefresh}>
                  Retry
                </Button>
              </div>
            )}

            {/* Table or Loading / Empty States */}
            {isLoading ? (
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : staffList.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title={search || roleFilter !== 'all' || statusFilter !== 'all' ? 'No matching staff members found' : 'No staff accounts created yet'}
                description={
                  search || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try modifying your search query or filter options.'
                    : 'Add staff members to collaborate on colony developments and plot listings.'
                }
                actionLabel={!search && roleFilter === 'all' && statusFilter === 'all' ? 'Add First Staff Member' : undefined}
                onAction={!search && roleFilter === 'all' && statusFilter === 'all' ? () => setCreateModalOpen(true) : undefined}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffList.map((staff) => {
                      const isSelf = Boolean(currentUser && staff.id === currentUser.id);
                      const isStaffSuspended = staff.isSuspended || !staff.isActive;
                      const displayName = [staff.firstName, staff.lastName].filter(Boolean).join(' ');

                      return (
                        <TableRow key={staff.id}>
                          <TableCell>
                            <div className="font-semibold text-slate-900">
                              {displayName || staff.email}
                              {isSelf && (
                                <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  You
                                </span>
                              )}
                            </div>
                            {displayName && <p className="text-xs text-slate-500">{staff.email}</p>}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                staff.role === 'FIRM_ADMIN'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {staff.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            {staff.role === 'FIRM_ADMIN' ? (
                              <span className="text-xs text-slate-500 font-medium">Full Tenant Access</span>
                            ) : staff.permissions && staff.permissions.length > 0 ? (
                              <span className="text-xs text-slate-700">
                                {staff.permissions.length} capabilities assigned
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">None assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={isStaffSuspended ? 'suspended' : 'active'} />
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-500">{formatDate(staff.createdAt)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDetails(staff)}
                                aria-label={`View details of ${staff.email}`}
                                className="h-8 w-8 p-0"
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-600" />
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditClick(staff)}
                                aria-label={`Edit ${staff.email}`}
                                className="h-8 w-8 p-0"
                                title="Edit staff profile & permissions"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                              </Button>

                              {isStaffSuspended ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStatusClick(staff, 'activate')}
                                  aria-label={`Reactivate ${staff.email}`}
                                  className="h-8 w-8 p-0 hover:text-emerald-600"
                                  title="Reactivate staff account"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStatusClick(staff, 'suspend')}
                                  aria-label={`Suspend ${staff.email}`}
                                  className="h-8 w-8 p-0 hover:text-amber-600"
                                  title={isSelf ? 'Cannot suspend own account' : 'Suspend staff account'}
                                  disabled={isSelf}
                                >
                                  <ShieldBan className="h-3.5 w-3.5 text-amber-500" />
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
                      <strong className="text-slate-900">{meta.totalPages}</strong> ({meta.total} total staff)
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
          </>
        )}
      </div>

      {/* Add Staff Modal */}
      {createModalOpen && (
        <CreateStaffModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={handleRefresh}
        />
      )}

      {/* Staff Details Modal */}
      <StaffDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        user={selectedUserForDetails}
      />

      {/* Edit Staff Modal */}
      {editModalOpen && (
        <EditStaffModal
          key={selectedUserForEdit?.id || 'edit-staff'}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          user={selectedUserForEdit}
          onSuccess={handleRefresh}
        />
      )}

      {/* Staff Status Modal */}
      {statusModalOpen && (
        <StaffStatusModal
          key={`${selectedUserForStatus?.id}-${statusMode}`}
          open={statusModalOpen}
          onOpenChange={setStatusModalOpen}
          targetUser={selectedUserForStatus}
          currentUserId={currentUser?.id}
          mode={statusMode}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}

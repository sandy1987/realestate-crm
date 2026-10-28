/**
 * frontend/app/audit/page.tsx
 *
 * Audit Trail page.
 * Dynamically routes to Platform or Tenant audit view based on authenticated role.
 */

'use client';

import React from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { isSuperAdmin } from '@/lib/utils/permissions';
import { AuditLogsView } from '@/components/audit/AuditLogsView';
import { Skeleton } from '@/components/ui/Loading';

export default function AuditPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // Branch strictly based on authenticated role
  if (isSuperAdmin(user)) {
    return <AuditLogsView mode="platform" />;
  }

  return <AuditLogsView mode="tenant" />;
}

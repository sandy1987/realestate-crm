'use client';

import React from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { isSuperAdmin, isFirmAdmin } from '@/lib/utils/permissions';
import { PlatformFirmsView } from '@/components/firm/PlatformFirmsView';
import { TenantFirmStaffView } from '@/components/firm/TenantFirmStaffView';
import { Skeleton } from '@/components/ui/Loading';

export default function FirmPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
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
    return <PlatformFirmsView />;
  }

  if (isFirmAdmin(user)) {
    return <TenantFirmStaffView readOnly={false} />;
  }

  // FIRM_STAFF: Can view current firm profile, but staff directory administration is read-only
  return <TenantFirmStaffView readOnly={true} />;
}

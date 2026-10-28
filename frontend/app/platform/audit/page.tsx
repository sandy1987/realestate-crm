/**
 * frontend/app/platform/audit/page.tsx
 *
 * Dedicated Platform Audit route for Super Administrators.
 */

'use client';

import React from 'react';
import { AuditLogsView } from '@/components/audit/AuditLogsView';

export default function PlatformAuditPage() {
  return <AuditLogsView mode="platform" />;
}

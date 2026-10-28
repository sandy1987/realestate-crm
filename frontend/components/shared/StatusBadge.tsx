import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { PlotStatus } from '@/types/plot';
import { FirmStatus } from '@/types/firm';
import { UserStatus } from '@/types/user';

type AnyStatus = PlotStatus | FirmStatus | UserStatus | boolean | string;

export interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Handle boolean active states (e.g. colony.isActive, plot.isActive)
  if (status === true) {
    return (
      <Badge variant="success" dot className={className}>
        Active
      </Badge>
    );
  }
  if (status === false) {
    return (
      <Badge variant="neutral" dot className={className}>
        Inactive
      </Badge>
    );
  }

  const normalized = String(status).toLowerCase();

  switch (normalized) {
    // Plot statuses matching src/models/Plot.model.js
    case 'available':
      return (
        <Badge variant="success" dot className={className}>
          Available
        </Badge>
      );
    case 'reserved':
      return (
        <Badge variant="warning" dot className={className}>
          Reserved
        </Badge>
      );
    case 'on_hold':
      return (
        <Badge variant="warning" dot className={className}>
          On Hold
        </Badge>
      );
    case 'sold':
      return (
        <Badge variant="destructive" dot className={className}>
          Sold
        </Badge>
      );
    case 'booked':
      return (
        <Badge variant="warning" dot className={className}>
          Booked
        </Badge>
      );
    case 'blocked':
      return (
        <Badge variant="neutral" dot className={className}>
          Blocked
        </Badge>
      );

    // Common active/inactive
    case 'active':
      return (
        <Badge variant="success" dot className={className}>
          Active
        </Badge>
      );
    case 'inactive':
    case 'archived':
      return (
        <Badge variant="neutral" dot className={className}>
          {normalized === 'archived' ? 'Archived' : 'Inactive'}
        </Badge>
      );
    case 'suspended':
      return (
        <Badge variant="destructive" dot className={className}>
          Suspended
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="warning" dot className={className}>
          Pending
        </Badge>
      );

    default:
      return (
        <Badge variant="default" className={className}>
          {String(status)}
        </Badge>
      );
  }
}

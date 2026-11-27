import React from 'react';
import { cn } from '@/lib/utils/cn';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode | React.ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  ...props
}: EmptyStateProps) {
  // Render icon whether passed as a JSX element (e.g. <Home className="h-6 w-6" />)
  // or as a component reference (e.g. Home)
  const renderedIcon = React.isValidElement(icon) ? (
    icon
  ) : typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon) ? (
    React.createElement(icon as React.ElementType, { className: 'h-6 w-6' })
  ) : (
    <Inbox className="h-6 w-6" />
  );

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50',
        className
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
        {renderedIcon}
      </div>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {description && <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

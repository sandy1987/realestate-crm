'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels: Record<string, string> = {
  colonies: 'Colonies',
  plots: 'Plots',
  firm: 'Firm Management',
  audit: 'Audit Logs',
  settings: 'Settings',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500">
      <ol className="flex items-center space-x-1.5">
        <li>
          <Link
            href="/"
            className="flex items-center text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only">Dashboard</span>
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

          return (
            <li key={href} className="flex items-center space-x-1.5">
              <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
              {isLast ? (
                <span className="font-semibold text-slate-800" aria-current="page">
                  {label}
                </span>
              ) : (
                <Link href={href} className="hover:text-slate-700 transition-colors">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

'use client';

import React from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuth } from '@/lib/context/AuthContext';
import { Menu, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] || 'User';

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-8 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:hidden cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb Path */}
        <div className="hidden sm:block">
          <Breadcrumbs />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* User profile & quick sign out */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-semibold">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden md:block text-left">
            <span className="text-xs font-semibold text-slate-800 block leading-tight">
              {displayName}
            </span>
            <span className="text-[10px] text-slate-500 font-mono block leading-tight">
              {user?.role || 'Authenticated'}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 ml-1"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { authApi } from '@/lib/api/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { isApiClientError } from '@/lib/api/errors';
import { formatDate } from '@/lib/utils/formatters';
import {
  Lock,
  User,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const validate = (): boolean => {
    const errors: typeof formErrors = {};

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters long';
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const result = await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      setStatusMessage({
        type: 'success',
        text:
          result.message ||
          'Password changed successfully. Active sessions have been invalidated.',
      });

      // Clear input fields for security
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormErrors({});
    } catch (err) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (isApiClientError(err)) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setStatusMessage({
            type: 'error',
            text: 'Current password verification failed. Please try again.',
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: err.message || 'Failed to change password.',
          });
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: 'An unexpected error occurred while changing password.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Account Settings & Security
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your personal profile and corporate account security credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-slate-500" />
              <CardTitle>User Profile</CardTitle>
            </div>
            <CardDescription>Verified database identity and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">Email:</span>
                <span className="font-mono text-slate-800">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">Name:</span>
                <span className="text-slate-800">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">Role:</span>
                <Badge variant="purple" size="sm">
                  {user?.role || 'FIRM_STAFF'}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">Firm Scope:</span>
                <span className="font-mono text-slate-800">
                  {user?.firmId || 'Platform Global'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-semibold text-slate-500">Member Since:</span>
                <span className="text-slate-800">{formatDate(user?.createdAt)}</span>
              </div>
            </div>

            <div>
              <p className="font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                Assigned Permissions:
              </p>
              <div className="flex flex-wrap gap-1">
                {user?.permissions && user.permissions.length > 0 ? (
                  user.permissions.map((perm) => (
                    <Badge key={perm} variant="neutral" size="sm">
                      {perm}
                    </Badge>
                  ))
                ) : (
                  <span className="text-slate-400 italic">
                    {user?.role === 'SUPER_ADMIN' || user?.role === 'FIRM_ADMIN'
                      ? 'Full Administrative Privileges'
                      : 'No explicit permissions assigned'}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-slate-500" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <CardDescription>
              Requires your current password and sets an Argon2id-hashed credential.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusMessage && (
              <div
                className={`mb-4 flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-relaxed ${
                  statusMessage.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                )}
                <div className="flex-1">{statusMessage.text}</div>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3.5" noValidate>
              <Input
                label="Current Password"
                type={showPasswords ? 'text' : 'password'}
                id="currentPassword"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (formErrors.currentPassword)
                    setFormErrors((prev) => ({ ...prev, currentPassword: undefined }));
                }}
                error={formErrors.currentPassword}
                leftIcon={<Lock className="h-4 w-4" />}
                disabled={isSubmitting}
                required
              />

              <Input
                label="New Password"
                type={showPasswords ? 'text' : 'password'}
                id="newPassword"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (formErrors.newPassword)
                    setFormErrors((prev) => ({ ...prev, newPassword: undefined }));
                }}
                error={formErrors.newPassword}
                leftIcon={<Lock className="h-4 w-4" />}
                disabled={isSubmitting}
                required
              />

              <Input
                label="Confirm New Password"
                type={showPasswords ? 'text' : 'password'}
                id="confirmPassword"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (formErrors.confirmPassword)
                    setFormErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }}
                error={formErrors.confirmPassword}
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                    tabIndex={-1}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                disabled={isSubmitting}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Account Recovery Notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-2xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold">Self-Service Account Recovery Note:</span> The
            backend does not provide a public forgot-password endpoint for security reasons. If
            you forget your password or your account is suspended, contact your organization&apos;s
            Firm Administrator or Platform Administrator.
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { sanitizeReturnUrl } from '@/lib/utils/url';
import { isApiClientError } from '@/lib/api/errors';
import { Compass, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const rawReturnUrl = searchParams.get('returnUrl');
  const returnUrl = sanitizeReturnUrl(rawReturnUrl, '/');

  // If already authenticated, redirect to return URL
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(returnUrl);
    }
  }, [isAuthenticated, isAuthLoading, router, returnUrl]);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email format';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
      });

      // Clear password from memory on success
      setPassword('');
      router.replace(returnUrl);
    } catch (err: unknown) {
      // Clear password field on failed attempt for security
      setPassword('');

      if (isApiClientError(err)) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setGeneralError('Invalid email or password. Please verify your credentials.');
        } else if (err.code === 'ACCOUNT_DISABLED') {
          setGeneralError('Your account has been deactivated or suspended. Please contact your administrator.');
        } else if (err.code === 'RATE_LIMIT_EXCEEDED' || err.status === 429) {
          setGeneralError('Too many login attempts. Please wait a few minutes before trying again.');
        } else {
          setGeneralError(err.message || 'Authentication failed. Please try again.');
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected network error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Brand Logo & Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
            <Compass className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            AGENT-Broker CRM
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Multi-Tenant Real Estate Platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign in to your account</CardTitle>
            <CardDescription>
              Enter your corporate email and password to access your firm workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generalError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1 leading-relaxed">{generalError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                label="Corporate Email"
                type="email"
                id="email"
                autoComplete="email"
                placeholder="name@firm.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                error={fieldErrors.email}
                leftIcon={<Mail className="h-4 w-4" />}
                disabled={isSubmitting}
                required
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                error={fieldErrors.password}
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security Note */}
        <p className="text-center text-xs text-slate-400">
          Secured by Argon2id & multi-tenant isolation. Unregistered sessions are strictly prohibited.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-xs text-slate-500">Loading sign in...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

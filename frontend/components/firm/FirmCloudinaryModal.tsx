'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Firm } from '@/types/firm';
import { platformFirmsApi } from '@/lib/api/platformFirms';
import { ApiClientError } from '@/lib/api/errors';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCw,
  Trash2,
  ShieldCheck,
  Server,
} from 'lucide-react';

export interface FirmCloudinaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firm: Firm | null;
  onSuccess: (updatedFirm: Firm) => void;
}

export function FirmCloudinaryModal({
  open,
  onOpenChange,
  firm,
  onSuccess,
}: FirmCloudinaryModalProps) {
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when firm changes or modal opens
  useEffect(() => {
    if (firm) {
      setCloudName(firm.cloudinary?.cloudName || '');
      setApiKey(firm.cloudinary?.apiKey || '');
      setApiSecret('');
      setShowSecret(false);
      setTestResult(null);
      setError(null);
    }
  }, [firm, open]);

  if (!firm) return null;

  const isCustomConfigured = Boolean(firm.cloudinary?.isConfigured && firm.cloudinary?.cloudName);

  const handleTestConnection = async () => {
    setTestResult(null);
    setError(null);

    if (!cloudName.trim() || !apiKey.trim() || !apiSecret.trim()) {
      setError('Please provide Cloud Name, API Key, and API Secret to test connection.');
      return;
    }

    setIsTesting(true);
    try {
      const res = await platformFirmsApi.testFirmCloudinary(firm.id, {
        cloudName: cloudName.trim(),
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: 'Connection verified! Cloudinary credentials are valid and ready to use.',
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Connection failed: Invalid Cloudinary credentials.',
        });
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to test Cloudinary credentials.';
      setTestResult({
        success: false,
        message: msg,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTestResult(null);

    if (!cloudName.trim()) {
      setError('Cloud Name is required.');
      return;
    }
    if (!apiKey.trim()) {
      setError('API Key is required.');
      return;
    }
    if (!apiSecret.trim()) {
      setError('API Secret is required.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedFirm = await platformFirmsApi.updateFirmCloudinary(firm.id, {
        cloudName: cloudName.trim(),
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
      });

      onSuccess(updatedFirm);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Failed to update Cloudinary storage configuration.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!window.confirm(`Reset ${firm.name}'s media storage back to Platform Default?`)) {
      return;
    }

    setError(null);
    setIsResetting(true);
    try {
      const updatedFirm = await platformFirmsApi.resetFirmCloudinary(firm.id);
      onSuccess(updatedFirm);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Failed to reset Cloudinary storage configuration.'
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Cloud className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Cloudinary Media Storage — {firm.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure dedicated Cloudinary account credentials for tenant slug{' '}
              <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">
                {firm.slug}
              </code>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSave} className="space-y-4 my-2 text-xs">
        {/* Status card */}
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                isCustomConfigured ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            />
            <div>
              <p className="font-semibold text-slate-800">
                {isCustomConfigured
                  ? 'Dedicated Tenant Cloudinary Storage'
                  : 'Platform Default Storage (.env Fallback)'}
              </p>
              <p className="text-[11px] text-slate-500">
                {isCustomConfigured
                  ? `Active Cloud Name: ${firm.cloudinary?.cloudName}`
                  : 'Media from this firm is currently stored in the shared platform Cloudinary bucket.'}
              </p>
            </div>
          </div>
          {isCustomConfigured && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              disabled={isResetting || isSaving}
              className="h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Reset to Default
            </Button>
          )}
        </div>

        {/* General error banner */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Test connection result banner */}
        {testResult && (
          <div
            className={`flex items-start gap-2 p-3 rounded-lg border ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cloud Name *
            </label>
            <Input
              value={cloudName}
              onChange={(e) => setCloudName(e.target.value)}
              placeholder="e.g. dxyz1234a"
              disabled={isSaving || isTesting}
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Found on the firm&apos;s Cloudinary Dashboard (Account Details).
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              API Key *
            </label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="e.g. 123456789012345"
              disabled={isSaving || isTesting}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              API Secret *
            </label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={isCustomConfigured ? '••••••••••••••••••••••••' : 'Enter API Secret'}
                disabled={isSaving || isTesting}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Encrypted in storage; never exposed in public responses.
            </span>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px] text-blue-800">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            Credentials are authenticated live via Cloudinary ping before saving to guarantee zero upload downtime.
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || isSaving || !cloudName || !apiKey || !apiSecret}
            className="text-xs"
          >
            {isTesting ? (
              <>
                <RotateCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Server className="h-3.5 w-3.5 mr-1.5" />
                Test Connection
              </>
            )}
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isTesting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || isTesting}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Activate'
              )}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}


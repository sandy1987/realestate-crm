'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plot } from '@/types/plot';
import { plotsApi, PlotWhatsAppShareData } from '@/lib/api/plots';
import { Copy, Check, ExternalLink, Loader2, Phone } from 'lucide-react';

export interface WhatsAppShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: Plot | null;
}

// Official WhatsApp icon SVG for high visual fidelity
function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.031 2C6.516 2 2.027 6.488 2.027 12c0 1.93.551 3.734 1.508 5.267L2 22l4.871-1.488A9.92 9.92 0 0 0 12.03 22c5.517 0 10.007-4.488 10.007-10s-4.49-10-10.006-10zm5.859 14.167c-.246.688-1.433 1.328-1.973 1.383-.51.055-1.168.082-3.375-.828-2.656-1.094-4.363-3.797-4.496-3.973-.133-.176-1.082-1.441-1.082-2.742 0-1.305.688-1.945.934-2.211.246-.266.535-.332.715-.332.179 0 .359 0 .515.012.168.012.395-.066.617.473.23.559.789 1.922.859 2.063.07.141.117.309.023.496-.094.188-.141.305-.281.473-.141.168-.297.375-.426.504-.145.145-.297.305-.129.594.168.289.746 1.234 1.602 1.996 1.102.98 2.031 1.285 2.32 1.426.289.141.457.121.625-.07.168-.191.719-.836.91-1.125.191-.289.383-.242.641-.148.258.094 1.637.773 1.918.914.281.141.469.211.539.328.07.117.07.68-.176 1.368z" />
    </svg>
  );
}

export function WhatsAppShareModal({ open, onOpenChange, plot }: WhatsAppShareModalProps) {
  const [shareData, setShareData] = useState<PlotWhatsAppShareData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !plot) {
      setShareData(null);
      setError(null);
      setPhoneInput('');
      setCopied(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    plotsApi
      .getWhatsAppShare(plot.id)
      .then((data) => {
        if (isMounted) {
          setShareData(data);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.response?.data?.error?.message || 'Failed to generate WhatsApp share message');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, plot]);

  const handleCopy = async () => {
    if (!shareData?.messageText) return;
    try {
      await navigator.clipboard.writeText(shareData.messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  const handleOpenWhatsApp = () => {
    if (!shareData) return;

    const encodedText = encodeURIComponent(shareData.messageText);
    const cleanedPhone = phoneInput.replace(/[^0-9]/g, '');

    // Is mobile browser check
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    let targetUrl = '';
    if (cleanedPhone) {
      // Direct message to specific phone number
      targetUrl = isMobile
        ? `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`
        : `https://web.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`;
    } else {
      // Direct share allowing user to select any contact or group
      targetUrl = isMobile
        ? `https://api.whatsapp.com/send?text=${encodedText}`
        : `https://web.whatsapp.com/send?text=${encodedText}`;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  if (!plot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-2xs">
            <WhatsAppIcon className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Share via WhatsApp
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Plot Reference: <span className="font-semibold text-slate-800">{plot.plotRef || plot.plotId}</span>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 my-2">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 text-slate-500 text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p>Formatting marketing details...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Message Preview */}
        {!isLoading && shareData && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Message Preview
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto text-xs text-slate-700 whitespace-pre-wrap font-sans select-all leading-relaxed shadow-inner">
                {shareData.messageText}
              </div>
            </div>

            {/* Optional Specific Phone Number */}
            <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                Optional Client Mobile Number
              </label>
              <Input
                type="tel"
                placeholder="e.g. 919876543210 (with country code)"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-slate-500">
                Leave blank to open WhatsApp Web and choose <strong>any contact or group</strong> from your chat list.
              </p>
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2 border-t border-slate-100 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isLoading || !shareData}
          onClick={handleOpenWhatsApp}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs font-semibold gap-1.5 cursor-pointer"
        >
          <WhatsAppIcon className="h-4 w-4" />
          <span>Open WhatsApp Web</span>
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

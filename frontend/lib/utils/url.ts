/**
 * Validates and sanitizes a return URL to prevent open redirect vulnerabilities.
 * Only internal relative paths starting with a single '/' are permitted.
 */
export function sanitizeReturnUrl(returnUrl: string | null | undefined, fallback: string = '/'): string {
  if (!returnUrl || typeof returnUrl !== 'string') {
    return fallback;
  }

  const trimmed = returnUrl.trim();

  // Reject empty string
  if (trimmed === '') {
    return fallback;
  }

  // Reject protocol-relative URLs (e.g. "//evil.com") or full absolute URLs
  if (trimmed.startsWith('//') || trimmed.includes('://')) {
    return fallback;
  }

  // Must begin with a single '/'
  if (!trimmed.startsWith('/')) {
    return fallback;
  }

  // Disallow control characters or newlines
  if (/[\r\n\t]/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

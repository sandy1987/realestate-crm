import { ApiErrorDetail, ApiErrorResponse } from '@/types/api';

/**
 * Normalized API Client Error class.
 * Preserves backend error code, status, message, and validation details.
 */
export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: ApiErrorDetail[] | unknown;
  public readonly isNetworkError: boolean;
  public readonly isTimeout: boolean;

  constructor({
    message,
    status = 500,
    code = 'INTERNAL_ERROR',
    details = null,
    isNetworkError = false,
    isTimeout = false,
  }: {
    message: string;
    status?: number;
    code?: string;
    details?: ApiErrorDetail[] | unknown;
    isNetworkError?: boolean;
    isTimeout?: boolean;
  }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isNetworkError = isNetworkError;
    this.isTimeout = isTimeout;

    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

/**
 * Type guard for ApiClientError
 */
export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

/**
 * Normalizes any caught error (Network, Timeout, Server JSON, or Unknown)
 * into a structured ApiClientError.
 */
export function normalizeApiError(error: unknown): ApiClientError {
  if (isApiClientError(error)) {
    return error;
  }

  // Handle AbortController timeout
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiClientError({
      message: 'Request timed out. Please check your network connection and try again.',
      status: 408,
      code: 'REQUEST_TIMEOUT',
      isTimeout: true,
    });
  }

  // Handle generic network fetch failures (e.g. offline, CORS failure)
  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
    return new ApiClientError({
      message: 'Unable to connect to the backend server. Please verify the server is running.',
      status: 0,
      code: 'NETWORK_ERROR',
      isNetworkError: true,
    });
  }

  // Handle standard JavaScript Error
  if (error instanceof Error) {
    return new ApiClientError({
      message: error.message,
      status: 500,
      code: 'CLIENT_ERROR',
    });
  }

  // Unknown fallback
  return new ApiClientError({
    message: 'An unexpected error occurred.',
    status: 500,
    code: 'UNKNOWN_ERROR',
  });
}

/**
 * Parses a backend error response payload into an ApiClientError.
 */
export function createErrorFromResponse(
  status: number,
  body: unknown,
  statusText?: string
): ApiClientError {
  const errorPayload = body as ApiErrorResponse | undefined;

  if (errorPayload && errorPayload.success === false && errorPayload.error) {
    return new ApiClientError({
      message: errorPayload.error.message || statusText || 'API request failed',
      status,
      code: errorPayload.error.code || 'API_ERROR',
      details: errorPayload.error.details,
    });
  }

  return new ApiClientError({
    message: statusText || `Request failed with status ${status}`,
    status,
    code: `HTTP_${status}`,
  });
}

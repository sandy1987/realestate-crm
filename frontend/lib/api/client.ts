import { envConfig } from '@/lib/config/env';
import { createErrorFromResponse, normalizeApiError, ApiClientError } from './errors';
import { ApiSuccessResponse, PaginationMeta } from '@/types/api';
import { tokenManager } from './tokenManager';
import { RefreshResponseData } from '@/types/auth';

/**
 * Configuration options for API requests.
 */
export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  token?: string | null;
  skipAuth?: boolean;
  _retry?: boolean;
}

export interface ApiResponseResult<T> {
  data: T;
  meta?: PaginationMeta;
  status: number;
}

/**
 * Builds a clean request URL preventing accidental double-slashes or prefix duplication.
 */
function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(
    `${base}${normalizedPath}`,
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  );

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Centralized Typed API Client for AGENT-Broker.
 * Automatically attaches in-memory access tokens and coordinates single-flight token rotation.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;

  constructor(baseUrl: string = envConfig.apiBaseUrl, defaultTimeout: number = 15000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Core request dispatcher with automatic 401 token refresh.
   */
  public async request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponseResult<T>> {
    const {
      params,
      body,
      headers: customHeaders,
      timeoutMs = this.defaultTimeout,
      token: explicitToken,
      skipAuth = false,
      _retry = false,
      ...fetchOptions
    } = options;

    const fullUrl = buildUrl(this.baseUrl, path, params);

    const headers = new Headers(customHeaders);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    if (body !== undefined && !(body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Attach Bearer token from explicit option or in-memory TokenManager
    if (!skipAuth) {
      const activeToken = explicitToken || tokenManager.getAccessToken();
      if (activeToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
    }

    // Timeout management via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(fullUrl, {
        ...fetchOptions,
        headers,
        body: body !== undefined && !(body instanceof FormData) ? JSON.stringify(body) : (body as BodyInit),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 204 No Content
      if (response.status === 204) {
        return { data: null as unknown as T, status: response.status };
      }

      const contentType = response.headers.get('content-type') || '';
      let responseBody: unknown;

      if (contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = null;
        }
      } else {
        responseBody = await response.text();
      }

      // Check for non-2xx status
      if (!response.ok) {
        const error = createErrorFromResponse(response.status, responseBody, response.statusText);

        // Check for 401 token refresh qualification:
        // - Status must be 401
        // - Must not already be a retried request
        // - Must not be an authentication entry-point (/auth/login, /auth/refresh, /auth/logout)
        // - Must have an available refresh token in TokenManager
        const isAuthRoute =
          path.includes('/auth/login') ||
          path.includes('/auth/refresh') ||
          path.includes('/auth/logout');

        if (response.status === 401 && !_retry && !isAuthRoute && tokenManager.getRefreshToken()) {
          try {
            // Coordinate single-flight refresh through TokenManager
            const newAccessToken = await tokenManager.executeRefresh(async (rToken) => {
              const refreshResult = await this.post<RefreshResponseData>(
                '/auth/refresh',
                { refreshToken: rToken },
                { skipAuth: true, _retry: true }
              );
              return refreshResult.data;
            });

            // Retry original request exactly once with new access token
            return await this.request<T>(path, {
              ...options,
              token: newAccessToken,
              _retry: true,
            });
          } catch (refreshErr) {
            // Refresh failed (token revoked/expired) - propagate original or normalized error
            throw normalizeApiError(refreshErr);
          }
        }

        throw error;
      }

      // Backend wraps payloads in standard envelope: { success: true, data: ..., meta?: ... }
      const envelope = responseBody as ApiSuccessResponse<T> | undefined;
      if (envelope && typeof envelope === 'object' && 'data' in envelope) {
        return {
          data: envelope.data,
          meta: envelope.meta,
          status: response.status,
        };
      }

      // Unenveloped fallback
      return {
        data: responseBody as T,
        status: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiClientError) {
        throw error;
      }
      throw normalizeApiError(error);
    }
  }

  public get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponseResult<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponseResult<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  public put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponseResult<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  public patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponseResult<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  public delete<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponseResult<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

/**
 * Singleton instance of ApiClient configured with validated environment base URL.
 */
export const apiClient = new ApiClient();

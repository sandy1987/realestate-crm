/**
 * In-Memory Token Manager for AGENT-Broker CRM Frontend.
 *
 * Security Guarantee:
 * - Tokens are stored strictly in JavaScript runtime memory.
 * - Access and refresh tokens are NEVER stored in localStorage or sessionStorage.
 * - Single-flight refresh mutex coordinates concurrent 401 requests to prevent
 *   replay-attack revocation on the backend.
 */

import { RefreshResponseData } from '@/types/auth';

type TokenUpdateListener = (tokens: { accessToken: string | null; refreshToken: string | null }) => void;
type AuthExpiredListener = (reason: string) => void;

class TokenManager {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;

  // Single-flight refresh coordination
  private refreshPromise: Promise<string | null> | null = null;

  // Listeners
  private tokenUpdateListeners: Set<TokenUpdateListener> = new Set();
  private authExpiredListeners: Set<AuthExpiredListener> = new Set();

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshTokenValue;
  }

  public setTokens(accessToken: string | null, refreshToken: string | null): void {
    this.accessToken = accessToken;
    this.refreshTokenValue = refreshToken;
    this.notifyTokenUpdate();
  }

  public clearTokens(reason: string = 'session_cleared'): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.refreshPromise = null;
    this.notifyTokenUpdate();
    this.notifyAuthExpired(reason);
  }

  public hasTokens(): boolean {
    return Boolean(this.accessToken);
  }

  public onTokenUpdate(listener: TokenUpdateListener): () => void {
    this.tokenUpdateListeners.add(listener);
    return () => this.tokenUpdateListeners.delete(listener);
  }

  public onAuthExpired(listener: AuthExpiredListener): () => void {
    this.authExpiredListeners.add(listener);
    return () => this.authExpiredListeners.delete(listener);
  }

  private notifyTokenUpdate(): void {
    this.tokenUpdateListeners.forEach((listener) => {
      try {
        listener({ accessToken: this.accessToken, refreshToken: this.refreshTokenValue });
      } catch (err) {
        console.error('Error in token update listener:', err);
      }
    });
  }

  private notifyAuthExpired(reason: string): void {
    this.authExpiredListeners.forEach((listener) => {
      try {
        listener(reason);
      } catch (err) {
        console.error('Error in auth expired listener:', err);
      }
    });
  }

  /**
   * Executes a single-flight token refresh.
   * If a refresh is already in-flight, subsequent concurrent callers will await the same promise.
   */
  public async executeRefresh(
    refreshFn: (refreshToken: string) => Promise<RefreshResponseData>
  ): Promise<string> {
    const currentRefreshToken = this.refreshTokenValue;

    if (!currentRefreshToken) {
      this.clearTokens('no_refresh_token');
      throw new Error('No refresh token available');
    }

    // If an in-flight refresh already exists, join it
    if (this.refreshPromise) {
      const token = await this.refreshPromise;
      if (!token) throw new Error('Refresh failed in concurrent operation');
      return token;
    }

    // Initiate single-flight refresh
    this.refreshPromise = (async () => {
      try {
        const response = await refreshFn(currentRefreshToken);
        this.accessToken = response.accessToken;
        this.refreshTokenValue = response.refreshToken;
        this.notifyTokenUpdate();
        return response.accessToken;
      } catch (error) {
        this.clearTokens('refresh_rejected');
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    const newToken = await this.refreshPromise;
    if (!newToken) throw new Error('Refresh token rotation failed');
    return newToken;
  }
}

export const tokenManager = new TokenManager();

/**
 * Frontend environment configuration.
 *
 * Validates and exposes safe client-accessible environment variables.
 * Never import server-only secrets or private credentials here.
 */

interface ClientConfig {
  apiBaseUrl: string;
  appName: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

function getValidatedApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    // Strip trailing slash for consistent concatenation
    return envUrl.trim().replace(/\/+$/, '');
  }

  // Development default pointing to Express backend at default port 5000
  if (process.env.NODE_ENV === 'production') {
    // In production, warn if variable is missing
    console.warn(
      '[AGENT-Broker Config] WARNING: NEXT_PUBLIC_API_BASE_URL is not configured. Falling back to relative path "/api".'
    );
    return '/api';
  }

  return 'http://localhost:5000/api';
}

export const envConfig: ClientConfig = {
  apiBaseUrl: getValidatedApiBaseUrl(),
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'AGENT-Broker CRM',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

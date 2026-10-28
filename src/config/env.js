/**
 * src/config/env.js
 *
 * Validates all required environment variables at startup using Zod.
 * Also loads .env via dotenv so local development works out of the box.
 *
 * RULES:
 *  - No other module should read process.env directly.
 *  - Import `config` (default export) for validated, typed env values.
 *  - Import `parseEnv` (named export) for unit testing the schema in isolation.
 *  - Application exits with a descriptive error if any required var is missing.
 */

import { configDotenv } from 'dotenv';
import { z } from 'zod';

// Load .env file if present (no-op in production / CI / test where vars are
// already injected by the platform or the test globalSetup).
configDotenv();

// ─── Validation schema ────────────────────────────────────────────────────────

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().positive().default(10),
});

// ─── Public parser (used by unit tests) ──────────────────────────────────────

/**
 * Validates a raw env object against the schema.
 * Throws an Error with a human-readable message on failure.
 * Does NOT call process.exit — safe to call in unit tests.
 *
 * @param {Record<string, unknown>} rawEnv - typically process.env
 * @returns {z.infer<typeof envSchema>} validated config
 */
export function parseEnv(rawEnv) {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const lines = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment configuration is invalid:\n${lines}`);
  }
  return result.data;
}

// ─── Module-level initialisation ─────────────────────────────────────────────

let config;

try {
  config = parseEnv(process.env);
} catch (err) {
  // Logger is not available yet — write directly to stderr.
  // This is the only permitted use of process.stderr.write in src/.
  process.stderr.write(`[FATAL] ${err.message}\n`);
  process.exit(1);
}

export default config;
export { config };

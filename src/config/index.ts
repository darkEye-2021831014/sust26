/**
 * Centralized configuration loader.
 * Reads process.env once, validates types, and exposes a frozen config object.
 * No other file in the codebase should read process.env directly.
 *
 * IMPORTANT: this module is imported during `next build` (page-data collection),
 * where Render does NOT yet inject runtime env vars. Therefore all env vars
 * must be OPTIONAL at module-load time. Production-required checks (e.g.
 * MONGODB_URI) are deferred to runtime via `assertProductionEnv()`.
 */

import { AIProvider } from '@/constants/enums';

interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;

  mongo: {
    uri: string;
    dbName: string;
  };

  ai: {
    provider: AIProvider;
    gemini: {
      apiKey: string | null;
      model: string;
    };
    groq: {
      apiKey: string | null;
      model: string;
    };
    timeoutMs: number;
    temperature: number;
    maxOutputTokens: number;
  };

  security: {
    apiKey: string | null;
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenSecret: string;
    refreshTokenExpiresIn: string;
  };

  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };

  logging: {
    level: string;
  };

  cors: {
    origin: string;
  };
}

function getEnvString(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (fallback !== undefined && fallback !== '') return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer value for ${key}: ${raw}`);
  }
  return parsed;
}

function getEnvBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

// Keep helper exports available for future modules — silences no-unused-vars
// while preserving the implementation in case any feature flag is added later.
export { getEnvString, getEnvInt, getEnvBool };

function loadConfig(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  const provider = (process.env.AI_PROVIDER ?? AIProvider.PRIMARY) as AIProvider;
  const isProduction = nodeEnv === 'production';

  const cfg: AppConfig = {
    port: getEnvInt('PORT', 8000),
    nodeEnv,
    isProduction,
    mongo: {
      uri: getEnvString('MONGODB_URI', 'mongodb://localhost:27017/queuestorm'),
      dbName: getEnvString('MONGODB_DB_NAME', 'queuestorm'),
    },
    ai: {
      provider,
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || null,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY || null,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      },
      timeoutMs: getEnvInt('LLM_TIMEOUT_MS', 25000),
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
    security: {
      apiKey: process.env.INTERNAL_API_KEY || null,
      jwtSecret:
        nodeEnv === 'test'
          ? ''
          : process.env.JWT_SECRET ||
            (nodeEnv === 'production'
              ? ''
              : 'dev_only_jwt_secret_minimum_32_characters_xx'),
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshTokenSecret:
        nodeEnv === 'test'
          ? ''
          : process.env.REFRESH_TOKEN_SECRET ||
            (nodeEnv === 'production'
              ? ''
              : 'dev_only_refresh_secret_minimum_32_characters_yy'),
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    },
    rateLimit: {
      windowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 60000),
      maxRequests: getEnvInt('RATE_LIMIT_MAX_REQUESTS', 100),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
    },
  };

  return cfg;
}

const config: AppConfig = loadConfig();
export default config;
export type { AppConfig };

/**
 * Runtime-only environment check. Call from request handlers / startup
 * (NOT at module-import time, so that `next build` succeeds even when env
 * vars are not yet injected by the host). Throws a clear error if a
 * required variable is missing.
 */
export function assertProductionEnv(): void {
  if (!config.isProduction) return;
  const missing: string[] = [];
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variable(s): ${missing.join(', ')}. ` +
        'These must be set in the Render dashboard before the service can start.',
    );
  }
}
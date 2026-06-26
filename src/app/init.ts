/**
 * Application-wide initialization on server start.
 * - Validates required production env vars (deferred from build time).
 * - Connects to MongoDB.
 * - Ensures indexes exist.
 * - Registers graceful shutdown handlers.
 *
 * In Next.js, this is invoked from `instrumentation.ts` at RUNTIME, not at
 * build time. This is critical on Render: `next build` runs with
 * NODE_ENV=production but the runtime env vars (MONGODB_URI, etc.) are not
 * yet injected, so all such checks must happen here.
 */

import config, { assertProductionEnv } from '@/config';
import { connectMongo, disconnectMongo } from '@/lib/mongodb';
import { ensureIndexes } from '@/database/indexes';
import logger from '@/utils/logger';

let initialized = false;

export async function startupInit(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Runtime-only env check. Logs a loud warning if a required var is missing
  // but does NOT block startup — the /health endpoint and the analyze-ticket
  // path (with audit-persistence degraded) must still work so the service
  // can serve traffic and the missing config is visible in the logs.
  try {
    assertProductionEnv();
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Production environment validation failed — service will start in degraded mode',
    );
    // eslint-disable-next-line no-console
    console.error(
      '[startup] WARNING (non-fatal):',
      err instanceof Error ? err.message : err,
    );
  }

  logger.info(
    {
      port: config.port,
      provider: config.ai.provider,
    },
    'QueueStorm Investigator starting',
  );

  try {
    await connectMongo();
    await ensureIndexes();
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      'Startup MongoDB init failed — service will continue and retry lazily',
    );
  }

  registerShutdownHandlers();
}

function registerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    try {
      await disconnectMongo();
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        'Error during MongoDB shutdown',
      );
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

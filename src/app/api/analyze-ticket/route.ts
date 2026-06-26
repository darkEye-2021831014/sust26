/**
 * POST /analyze-ticket
 *
 * Analyzes a customer support ticket against the provided transaction history.
 * Returns evidence-grounded classification, routing, and a safe customer reply.
 *
 * Authentication: optional but supported (X-Api-Key header).
 * Rate limit: per IP, 100 req/min by default.
 * Timeout: 28s hard ceiling per request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeTicketController } from '@/controllers/ticketController';
import { handleError } from '@/middleware/errorHandler';
import { withRequestContext } from '@/middleware/requestLogger';
import { checkRateLimit } from '@/middleware/rateLimiter';
import { authenticateRequest } from '@/middleware/auth';
import { applySecurityHeaders } from '@/middleware/securityHeaders';
import { REQUEST_TIMEOUT_MS } from '@/config/constants';
import { TimeoutError } from '@/utils/errors';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(req: NextRequest): Promise<NextResponse> {
  // 1. Auth (if API key is configured)
  const authError = authenticateRequest(req);
  if (authError) return authError;

  // 2. Rate limiting
  const rateLimited = await checkRateLimit(req);
  if (rateLimited) return rateLimited as NextResponse;

  // 3. Hard timeout so we never exceed the 30s service limit.
  //    The timer is cleared on success to avoid an unhandled rejection later.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = analyzeTicketController(req);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
  });
  let result;
  try {
    result = await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  return applySecurityHeaders(
    NextResponse.json(result.body, { status: result.status, headers: result.headers }),
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await withRequestContext(req, async () => handle(req));
  } catch (err) {
    const { body, status } = handleError(err);
    // Print every 5xx so the dev sees it in the terminal.
    if (status >= 500) {
      logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'analyze-ticket 5xx');
      // eslint-disable-next-line no-console
      console.error('[analyze-ticket] 5xx response — see error details above');
    }
    return applySecurityHeaders(NextResponse.json(body, { status }));
  }
}
/**
 * Request logger middleware (Pino).
 * Assigns a request ID to every request, logs start/finish, and exposes
 * the ID on the response so agents can correlate with logs.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';
import { LOG_PAYLOAD_TRUNCATE } from '@/config/constants';

export const REQUEST_ID_HEADER = 'x-request-id';

export interface IRequestContext {
  requestId: string;
  startTimeMs: number;
  ip: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __requestContext: IRequestContext | undefined;
}

export function withRequestContext(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.length <= 128 ? incoming : uuidv4();
  const start = Date.now();
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  globalThis.__requestContext = { requestId, startTimeMs: start, ip };

  logger.info(
    {
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      ip,
    },
    'request.start',
  );

  return handler()
    .then((response) => {
      const duration = Date.now() - start;
      logger.info(
        {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          status: response.status,
          durationMs: duration,
        },
        'request.end',
      );
      if (response.status >= 500) {
        // Surface 5xx responses on the dev terminal as well.
        // eslint-disable-next-line no-console
        console.error(
          `[5xx] ${request.method} ${new URL(request.url).pathname} -> ${response.status} (${duration}ms) [${requestId}]`,
        );
      }
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    })
    .catch((err) => {
      const duration = Date.now() - start;
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      logger.error(
        {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          durationMs: duration,
          err: errMessage,
          stack: errStack,
        },
        'request.error',
      );
      // eslint-disable-next-line no-console
      console.error(
        `[request.error] ${request.method} ${new URL(request.url).pathname} (${duration}ms) [${requestId}]`,
      );
      // eslint-disable-next-line no-console
      console.error(err);
      throw err;
    })
    .finally(() => {
      globalThis.__requestContext = undefined;
    });
}

export function getCurrentRequestContext(): IRequestContext | undefined {
  return globalThis.__requestContext;
}

export function truncate(value: string, max = LOG_PAYLOAD_TRUNCATE): string {
  if (!value) return value;
  return value.length <= max ? value : `${value.slice(0, max)}…[truncated]`;
}
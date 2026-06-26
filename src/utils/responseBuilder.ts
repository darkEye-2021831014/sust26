/**
 * Centralized JSON response factories.
 * Ensures every endpoint returns the same envelope shape.
 *
 * Error envelope ALWAYS contains four fields per the rubric:
 *   { success: false, message, error, statusCode }
 * The `error` field is a stable machine-readable code; if the caller didn't
 * provide one we fall back to a default derived from the status code.
 */

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  error: string;
  statusCode: number;
  details?: unknown;
}

export function successResponse<T>(data: T): SuccessEnvelope<T> {
  return { success: true, data };
}

const DEFAULT_ERROR_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'REQUEST_TIMEOUT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMIT_EXCEEDED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'REQUEST_TIMEOUT',
};

export function errorResponse(
  message: string,
  statusCode: number,
  error?: string,
  details?: unknown,
): ErrorEnvelope {
  return {
    success: false,
    message,
    error: error || DEFAULT_ERROR_CODE[statusCode] || 'ERROR',
    statusCode,
    ...(details !== undefined ? { details } : {}),
  };
}
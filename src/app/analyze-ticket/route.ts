/**
 * POST /analyze-ticket — top-level alias for /api/analyze-ticket.
 *
 * Matches the literal path documented in instruction_and_evaluation.pdf.
 */

import { POST as apiAnalyzePOST } from '@/app/api/analyze-ticket/route';
import { applySecurityHeaders } from '@/middleware/securityHeaders';
import { errorResponse } from '@/utils/responseBuilder';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const res = await apiAnalyzePOST(req as unknown as import('next/server').NextRequest);
    return applySecurityHeaders(res);
  } catch (err) {
    // Defensive: never let an uncaught error turn into "Internal Server Error"
    // with no console output. The inner route already has a try/catch, but if
    // a framework-level throw escapes it, surface it loudly.
    // eslint-disable-next-line no-console
    console.error('[analyze-ticket] unhandled error in top-level alias:', err);
    return applySecurityHeaders(
      NextResponse.json(
        errorResponse(
          'Internal server error',
          500,
          'INTERNAL_ERROR',
          err instanceof Error ? { message: err.message } : undefined,
        ),
        { status: 500 },
      ),
    );
  }
}
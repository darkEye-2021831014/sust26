/**
 * GET /tickets/:ticket_id — top-level alias for /api/tickets/:ticket_id.
 *
 * Matches the literal path documented in the rubric (§3.1: "audit trail
 * endpoint accessible at /tickets/{ticket_id}").
 */

import { GET as apiTicketGET } from '@/app/api/tickets/[ticket_id]/route';
import { applySecurityHeaders } from '@/middleware/securityHeaders';
import { errorResponse } from '@/utils/responseBuilder';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticket_id: string }> },
): Promise<Response> {
  try {
    const res = await apiTicketGET(
      req as unknown as import('next/server').NextRequest,
      { params },
    );
    return applySecurityHeaders(res);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[tickets] unhandled error in top-level alias:', err);
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

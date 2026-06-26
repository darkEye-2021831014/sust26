/**
 * Rubric §3.5 envelope-shape compliance test.
 *
 * Every response (success OR error) must include the four required fields:
 *   success, message/error, error/statusCode, statusCode/data.
 *
 * Concretely:
 *   - 2xx: { success: true, data: {...} }
 *   - 4xx/5xx: { success: false, message, error, statusCode } (all four
 *     MUST be present, even on the catch-all 500 path)
 */

import { POST as analyzePOST } from '@/app/api/analyze-ticket/route';
import { POST as batchPOST } from '@/app/api/analyze-ticket-batch/route';
import { GET as healthGET } from '@/app/api/health/route';
import { GET as ticketGET } from '@/app/api/tickets/[ticket_id]/route';

jest.mock('@/lib/mongodb', () => ({
  connectMongo: jest.fn().mockResolvedValue(undefined),
  disconnectMongo: jest.fn().mockResolvedValue(undefined),
  isMongoConnected: jest.fn().mockReturnValue(false),
}));

jest.mock('@/services/auditService', () => ({
  auditTicket: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/repositories/ticketRepository', () => ({
  findTicketAnalysesByTicketId: jest.fn().mockResolvedValue([]),
}));

function makeReq(path: string, body?: unknown, contentType = 'application/json'): Request {
  return new Request(`http://localhost:8000${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('Rubric §3.5 — response envelope shape', () => {
  it('success response: { success: true, data: {...} }', async () => {
    const req = makeReq('/api/analyze-ticket', {
      ticket_id: 'TKT-ENV-1',
      complaint: 'I sent 500 taka to a wrong number.',
    });
    const res = await analyzePOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data).toBe('object');
  });

  it('error 400: all four required fields are present (VALIDATION_FAILED)', async () => {
    const req = makeReq('/api/analyze-ticket', {});
    const res = await analyzePOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message');
    expect(typeof body.message).toBe('string');
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body).toHaveProperty('statusCode', 400);
  });

  it('error 400 (bad JSON): all four required fields are present (BAD_JSON)', async () => {
    const req = makeReq('/api/analyze-ticket', 'not json');
    const res = await analyzePOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('statusCode', 400);
    expect(typeof body.error).toBe('string');
  });

  it('error 400 (bad content-type): all four required fields are present', async () => {
    const req = new Request('http://localhost:8000/api/analyze-ticket', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'whatever',
    });
    const res = await analyzePOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('statusCode', 400);
  });

  it('error 400 (bad enum): all four required fields are present', async () => {
    const req = makeReq('/api/analyze-ticket', {
      ticket_id: 'TKT-1',
      complaint: 'hi',
      channel: 'carrier_pigeon',
    });
    const res = await analyzePOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('statusCode', 400);
  });

  it('batch error 400 (empty array): all four required fields are present', async () => {
    const req = makeReq('/api/analyze-ticket-batch', { tickets: [] });
    const res = await batchPOST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('statusCode', 400);
  });

  it('tickets audit 400 (empty ticket_id): all four required fields are present', async () => {
    const req = new Request('http://localhost:8000/api/tickets/', { method: 'GET' });
    const res = await ticketGET(req as unknown as import('next/server').NextRequest, {
      params: Promise.resolve({ ticket_id: '' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('statusCode', 400);
  });

  it('health endpoint returns the documented shape', async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('timestamp');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });
});

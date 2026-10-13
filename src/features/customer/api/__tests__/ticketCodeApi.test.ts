import { fetchTicketCode, TICKET_CODE_TIMEOUT_MS } from '@/features/customer/api/ticketCodeApi';
import { ticketCodeBody } from '@/features/customer/schemas/ticketCode';
import type { ApiError } from '@/shared/lib/errors';
import { err, type Result } from '@/shared/lib/result';

function fake() {
  const calls: { path: string; opts: Record<string, unknown> }[] = [];
  const client = {
    request: <T>(path: string, opts: object): Promise<Result<T, ApiError>> => {
      calls.push({ path, opts: opts as Record<string, unknown> });
      return Promise.resolve(err<ApiError>({ kind: 'timeout' }));
    },
  };
  return { client, calls };
}

it('GETs the encoded ticket path with the ticket code schema and an 8 s timeout', async () => {
  const { client, calls } = fake();
  const r = await fetchTicketCode(client, 't/1 2');
  expect(TICKET_CODE_TIMEOUT_MS).toBe(8_000);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.path).toBe(`/api/tickets/${encodeURIComponent('t/1 2')}/code`);
  expect(calls[0]?.path).toBe('/api/tickets/t%2F1%202/code');
  expect(calls[0]?.opts.schema).toBe(ticketCodeBody);
  expect(calls[0]?.opts.timeoutMs).toBe(8_000);
  expect(calls[0]?.opts.method ?? 'GET').toBe('GET');
  expect(r).toEqual({ ok: false, error: { kind: 'timeout' } });
});

it('never marks the request idempotent (the client already retries GETs)', async () => {
  const { client, calls } = fake();
  await fetchTicketCode(client, 't1');
  expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
});

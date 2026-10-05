import { submitScan, fetchSummary, SCAN_TIMEOUT_MS } from '@/features/gate/api/scan';
import { parseTicketCode } from '@/features/gate/domain/parseTicketCode';
import type { ApiError } from '@/shared/lib/errors';
import { err, type Result } from '@/shared/lib/result';

const EVENT = '11111111-1111-4111-8111-111111111111';

function fake() {
  const calls: { path: string; opts: object }[] = [];
  const client = {
    request: <T>(path: string, opts: object): Promise<Result<T, ApiError>> => {
      calls.push({ path, opts });
      return Promise.resolve(err<ApiError>({ kind: 'timeout' }));
    },
  };
  return { client, calls };
}

it('posts the code with a 6 s timeout and no retry flag', async () => {
  const { client, calls } = fake();
  const code = parseTicketCode('3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f');
  if (!code) throw new Error('fixture');
  await submitScan(client, EVENT, code.value);
  expect(calls[0]?.path).toBe(`/api/events/${EVENT}/scan`);
  expect(calls[0]?.opts).toEqual(
    expect.objectContaining({
      method: 'POST',
      body: { ticket_id: code.value },
      timeoutMs: SCAN_TIMEOUT_MS,
    }),
  );
  expect(SCAN_TIMEOUT_MS).toBe(6_000);
  expect(calls[0]?.opts).not.toHaveProperty('idempotent');
});

it('gets the summary', async () => {
  const { client, calls } = fake();
  await fetchSummary(client, EVENT);
  expect(calls[0]?.path).toBe(`/api/events/${EVENT}/scan/summary`);
  expect(calls[0]?.opts).toEqual(expect.objectContaining({ schema: expect.anything() as unknown }));
});

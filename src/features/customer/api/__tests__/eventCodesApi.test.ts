import { fetchEventCodes } from '@/features/customer/api/eventCodesApi';
import { eventCodesBody } from '@/features/customer/schemas/actions';

import { fakeRequester } from './fakeRequester';

const body = {
  format: 2,
  expires_at: 1761000030000,
  step_seconds: 30,
  tickets: [
    { id: 't1', ticket_type: 'VIP', ticket_index: 1, checked_in_at: null, token: 'BH2.abc' },
    {
      id: 't2',
      ticket_type: 'VIP',
      ticket_index: 2,
      checked_in_at: '2026-11-01T19:30:00Z',
      token: null,
    },
  ],
};

it('GETs the encoded booking path with the codes schema and an 8 s timeout', async () => {
  const { client, calls } = fakeRequester({ body });
  await fetchEventCodes(client, 'b/1 2');
  expect(calls[0]?.path).toBe('/api/bookings/event/b%2F1%202/codes');
  expect(calls[0]?.opts.schema).toBe(eventCodesBody);
  expect(calls[0]?.opts.timeoutMs).toBe(8_000);
  expect(calls[0]?.opts.method ?? 'GET').toBe('GET');
  expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
});

it('maps the codes, keeping a used ticket as a null token', async () => {
  const { client } = fakeRequester({ body });
  expect(await fetchEventCodes(client, 'b1')).toEqual({
    ok: true,
    value: {
      format: 2,
      expiresAt: 1761000030000,
      stepSeconds: 30,
      tickets: [
        { id: 't1', type: 'VIP', index: 1, checkedInAt: null, token: 'BH2.abc' },
        { id: 't2', type: 'VIP', index: 2, checkedInAt: '2026-11-01T19:30:00Z', token: null },
      ],
    },
  });
});

it('no tickets issued yet: format and expiry are null', async () => {
  const { client } = fakeRequester({
    body: { format: null, expires_at: null, step_seconds: 30, tickets: [] },
  });
  expect(await fetchEventCodes(client, 'b1')).toEqual({
    ok: true,
    value: { format: null, expiresAt: null, stepSeconds: 30, tickets: [] },
  });
});

it('a bare 404 is a deploy without the route: fall back to the per-ticket route', async () => {
  const { client } = fakeRequester({ error: { kind: 'notFound' } });
  expect(await fetchEventCodes(client, 'b1')).toEqual({ ok: true, value: { fallback: true } });
});

it.each([
  { kind: 'notFound', code: 'not_found' },
  { kind: 'forbidden', code: 'forbidden' },
  { kind: 'conflict', code: 'not_confirmed' },
  { kind: 'unavailable', status: 503, code: 'unavailable' },
] as const)("the route's own answers pass through: %p", async (error) => {
  const { client } = fakeRequester({ error });
  expect(await fetchEventCodes(client, 'b1')).toEqual({ ok: false, error });
});

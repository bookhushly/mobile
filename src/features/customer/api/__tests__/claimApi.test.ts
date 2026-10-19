import { claim, claimCounts, sendClaimCode } from '@/features/customer/api/claimApi';

import { fakeRequester } from './fakeRequester';

it('GETs the counts', async () => {
  const counts = { events: 2, hotels: 1, apartments: 0, total: 3 };
  const { client, calls } = fakeRequester({ body: counts });
  expect(await claimCounts(client)).toEqual({ ok: true, value: counts });
  expect(calls[0]?.path).toBe('/api/bookings/claim');
  expect(calls[0]?.opts.method ?? 'GET').toBe('GET');
  expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
});

it('POSTs the code request with no body', async () => {
  const { client, calls } = fakeRequester({ body: { sent: true } });
  expect(await sendClaimCode(client)).toEqual({ ok: true, value: { sent: true } });
  expect(calls[0]?.path).toBe('/api/bookings/claim/code');
  expect(calls[0]?.opts.method).toBe('POST');
  expect('body' in (calls[0]?.opts ?? {})).toBe(false);
  expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
});

it('POSTs exactly {code}, trimmed, and reads the result', async () => {
  const result = {
    claimed: { events: 1, hotels: 0, apartments: 0, total: 1 },
    booking_ids: { events: ['e1'], hotels: [], apartments: [] },
    payments: 1,
  };
  const { client, calls } = fakeRequester({ body: result });
  expect(await claim(client, ' 123456 ')).toEqual({ ok: true, value: result });
  expect(calls[0]?.path).toBe('/api/bookings/claim');
  expect(calls[0]?.opts.method).toBe('POST');
  expect(calls[0]?.opts.body).toEqual({ code: '123456' });
  expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
});

it('a result without the informational fields still reads as claimed', async () => {
  const { client } = fakeRequester({
    body: { claimed: { events: 0, hotels: 0, apartments: 0, total: 0 } },
  });
  expect(await claim(client, '123456')).toEqual({
    ok: true,
    value: {
      claimed: { events: 0, hotels: 0, apartments: 0, total: 0 },
      booking_ids: undefined,
      payments: undefined,
    },
  });
});

it.each(['12345', '1234567', 'abcdef', ''])('a malformed code %p is never sent', async (code) => {
  const { client, calls } = fakeRequester({ body: {} });
  expect(await claim(client, code)).toEqual({ ok: false, error: { kind: 'validation' } });
  expect(calls).toHaveLength(0);
});

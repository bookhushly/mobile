import { readAllNotifications } from '@/features/customer/api/notificationsApi';
import { readAllBody } from '@/features/customer/schemas/actions';

import { fakeRequester } from './fakeRequester';

it('POSTs read-all with no body and is never idempotent', async () => {
  const { client, calls } = fakeRequester({ body: { updated: 3 } });
  expect(await readAllNotifications(client)).toEqual({ ok: true, value: { updated: 3 } });
  expect(calls[0]?.path).toBe('/api/notifications/read-all');
  expect(calls[0]?.opts.method).toBe('POST');
  expect(calls[0]?.opts.schema).toBe(readAllBody);
  expect('body' in (calls[0]?.opts ?? {})).toBe(false);
  expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
});

it('a 404 falls back to the RLS write', async () => {
  const { client } = fakeRequester({ error: { kind: 'notFound' } });
  expect(await readAllNotifications(client)).toEqual({ ok: true, value: { fallback: true } });
});

it('a 401 stays a 401 (no silent 0 rows)', async () => {
  const { client } = fakeRequester({ error: { kind: 'auth' } });
  expect(await readAllNotifications(client)).toEqual({ ok: false, error: { kind: 'auth' } });
});

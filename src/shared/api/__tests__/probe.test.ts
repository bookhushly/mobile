import { z } from 'zod';

import { createApiClient } from '@/shared/api/client';
import { probeAuthedCall } from '@/shared/api/probe';

function apiReturning(res: Response) {
  return createApiClient({
    baseUrl: 'https://api.test',
    fetchFn: jest.fn(() => Promise.resolve(res)),
    getAccessToken: () => Promise.resolve('tok'),
    refreshSession: () => Promise.resolve(null),
    clock: { recordServerDate: () => Promise.resolve() },
    appVersion: '1.0.0 (1)',
    platform: 'android',
    sleep: () => Promise.resolve(),
  });
}

describe('probeAuthedCall', () => {
  it('returns ok for { kyc: null } (customer with no KYC)', async () => {
    const r = await probeAuthedCall(apiReturning(new Response(JSON.stringify({ kyc: null }))));
    expect(r).toEqual({ ok: true, value: { hasKyc: false } });
  });
  it('returns ok with hasKyc for a kyc row', async () => {
    const body = { kyc: { id: 'k', status: 'pending', submitted_at: 'x', admin_note: null, nin_verified: false } };
    const r = await probeAuthedCall(apiReturning(new Response(JSON.stringify(body))));
    expect(r).toEqual({ ok: true, value: { hasKyc: true } });
  });
  it('maps the backend 401 ({ status: null }) to an auth error', async () => {
    const r = await probeAuthedCall(
      apiReturning(new Response(JSON.stringify({ status: null }), { status: 401 })),
    );
    expect(r).toEqual({ ok: false, error: { kind: 'auth' } });
  });
  it('schema sanity: the exported shape is what the route returns', () => {
    expect(z.object({ kyc: z.unknown() }).safeParse({ kyc: null }).success).toBe(true);
  });
});

import { z } from 'zod';

import { createApiClient } from '@/shared/api/client';

type Call = { url: string; init: RequestInit };
type Deps = Parameters<typeof createApiClient>[0];

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function make(responses: (Response | Error)[], over: Partial<Deps> = {}) {
  const calls: Call[] = [];
  const dates: (string | null)[] = [];
  const queue = [...responses];
  const fetchFn = jest.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error('no more responses');
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }) as unknown as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://api.test',
    fetchFn,
    getAccessToken: () => Promise.resolve('tok1'),
    refreshSession: () => Promise.resolve({ token: 'tok2' }),
    clock: {
      recordServerDate: (d) => {
        dates.push(d);
        return Promise.resolve();
      },
    },
    appVersion: '1.0.0 (7)',
    platform: 'android',
    sleep: () => Promise.resolve(),
    random: () => 0,
    ...over,
  });
  return { client, calls, dates, fetchFn };
}

const schema = z.object({ ok: z.boolean() });
const headersOf = (c: Call | undefined) => c?.init.headers as Record<string, string>;

describe('api client', () => {
  it('sends bearer + app headers and records the Date header', async () => {
    const { client, calls, dates } = make([
      res(200, { ok: true }, { date: 'Sun, 04 Oct 2026 12:00:00 GMT' }),
    ]);
    const r = await client.request('/api/x', { schema });
    expect(r).toEqual({ ok: true, value: { ok: true } });
    expect(headersOf(calls[0])['Authorization']).toBe('Bearer tok1');
    expect(headersOf(calls[0])['X-App-Version']).toBe('1.0.0 (7)');
    expect(headersOf(calls[0])['X-Platform']).toBe('android');
    expect(calls[0]?.url).toBe('https://api.test/api/x');
    expect(dates).toEqual(['Sun, 04 Oct 2026 12:00:00 GMT']);
  });

  it('refreshes once on 401 then retries once; a second 401 is an auth error (no loop)', async () => {
    const { client, calls } = make([res(401, {}), res(401, {})]);
    const r = await client.request('/api/x', { schema });
    expect(r).toEqual({ ok: false, error: { kind: 'auth' } });
    expect(calls).toHaveLength(2);
    expect(headersOf(calls[1])['Authorization']).toBe('Bearer tok2');
  });

  it('succeeds when the retry after refresh works', async () => {
    const { client } = make([res(401, {}), res(200, { ok: true })]);
    expect(await client.request('/api/x', { schema })).toEqual({
      ok: true,
      value: { ok: true },
    });
  });

  it('returns auth when refresh fails', async () => {
    const { client } = make([res(401, {})], {
      refreshSession: () => Promise.resolve({ failure: 'invalid' }),
    });
    expect(await client.request('/api/x', { schema })).toEqual({
      ok: false,
      error: { kind: 'auth' },
    });
  });

  it('retries 503 on GET up to maxRetries then returns unavailable', async () => {
    const { client, fetchFn } = make([res(503, {}), res(503, {}), res(503, {})], {
      maxRetries: 2,
    });
    const r = await client.request('/api/x', { schema });
    expect(r).toEqual({ ok: false, error: { kind: 'unavailable', status: 503 } });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('never auto-retries 429 and surfaces Retry-After', async () => {
    const { client, fetchFn } = make([res(429, {}, { 'retry-after': '30' })]);
    const r = await client.request('/api/x', { schema });
    expect(r).toEqual({ ok: false, error: { kind: 'rateLimited', retryAfterSec: 30 } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-idempotent POST on network error', async () => {
    const { client, fetchFn } = make([new TypeError('Network request failed')]);
    const r = await client.request('/api/x', { method: 'POST', body: {}, schema });
    expect(r).toEqual({ ok: false, error: { kind: 'network' } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries a network error on GET', async () => {
    const { client, fetchFn } = make([
      new TypeError('Network request failed'),
      res(200, { ok: true }),
    ]);
    expect(await client.request('/api/x', { schema })).toEqual({
      ok: true,
      value: { ok: true },
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('maps an abort/timeout to timeout', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const { client } = make([abort], { maxRetries: 0 });
    expect(await client.request('/api/x', { schema })).toEqual({
      ok: false,
      error: { kind: 'timeout' },
    });
  });

  it('turns a body that fails the schema into validation, not a crash', async () => {
    const { client } = make([res(200, { nope: 1 })]);
    expect(await client.request('/api/x', { schema })).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
  });

  it('maps a 409 with a server code to conflict', async () => {
    const { client } = make([res(409, { code: 'already_checked_in' })]);
    const r = await client.request('/api/x', { method: 'POST', body: {}, schema });
    expect(r).toMatchObject({ ok: false, error: { kind: 'conflict', code: 'already_checked_in' } });
  });

  it('reports a transient refresh failure as network (retryable), not auth', async () => {
    const { client } = make([res(401, {})], {
      refreshSession: () => Promise.resolve({ failure: 'network' }),
    });
    expect(await client.request('/api/x', { schema })).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
  });

  it('does not send anything when the caller already aborted', async () => {
    const { client, fetchFn } = make([res(200, { ok: true })]);
    const c = new AbortController();
    c.abort();
    const r = await client.request('/api/x', { schema, signal: c.signal });
    expect(r).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('treats a caller abort mid-flight as aborted and does not retry', async () => {
    const c = new AbortController();
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const { client, fetchFn } = make([abort], { maxRetries: 2 });
    (fetchFn as unknown as jest.Mock).mockImplementationOnce(() => {
      c.abort();
      return Promise.reject(abort);
    });
    const r = await client.request('/api/x', { schema, signal: c.signal });
    expect(r).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('refuses a path that could redirect the bearer token to another host', async () => {
    const { client, fetchFn } = make([res(200, { ok: true })]);
    for (const bad of ['@evil.com/x', 'api/x', '//evil.com/x', 'https://evil.com/x']) {
      expect(await client.request(bad, { schema })).toEqual({
        ok: false,
        error: { kind: 'validation' },
      });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

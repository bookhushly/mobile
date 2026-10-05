import { errorFromResponse, isRetryable, type ApiError } from '@/shared/lib/errors';

const h = (o: Record<string, string> = {}) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe('errorFromResponse', () => {
  it('maps 401 to auth and 403 to forbidden', () => {
    expect(errorFromResponse(401, {}, h()).kind).toBe('auth');
    expect(errorFromResponse(403, { code: 'forbidden' }, h())).toEqual({
      kind: 'forbidden',
      code: 'forbidden',
    });
  });
  it('maps 404/409 with server code', () => {
    expect(errorFromResponse(404, { code: 'not_found' }, h())).toEqual({
      kind: 'notFound',
      code: 'not_found',
    });
    expect(
      errorFromResponse(409, { code: 'already_checked_in', checked_in_at: 'x' }, h()),
    ).toMatchObject({ kind: 'conflict', code: 'already_checked_in' });
  });
  it('maps 429 with Retry-After seconds, tolerating junk', () => {
    expect(errorFromResponse(429, {}, h({ 'retry-after': '12' }))).toEqual({
      kind: 'rateLimited',
      retryAfterSec: 12,
    });
    expect(errorFromResponse(429, {}, h({ 'retry-after': 'soon' }))).toEqual({
      kind: 'rateLimited',
    });
    expect(errorFromResponse(429, {}, h())).toEqual({ kind: 'rateLimited' });
  });
  it('maps 5xx to unavailable and other codes to unknown', () => {
    expect(errorFromResponse(503, { code: 'lookup_failed' }, h())).toEqual({
      kind: 'unavailable',
      status: 503,
      code: 'lookup_failed',
    });
    expect(errorFromResponse(418, null, h())).toEqual({ kind: 'unknown', status: 418 });
  });
  it('keeps the code on a 400', () => {
    const headers = { get: () => null };
    expect(errorFromResponse(400, { code: 'invalid_code' }, headers)).toEqual({
      kind: 'unknown',
      status: 400,
      code: 'invalid_code',
    });
    expect(errorFromResponse(400, { error: 'x' }, headers)).toEqual({
      kind: 'unknown',
      status: 400,
    });
  });
});

describe('isRetryable', () => {
  const cases: [ApiError, boolean][] = [
    [{ kind: 'network' }, true],
    [{ kind: 'timeout' }, true],
    [{ kind: 'rateLimited' }, true],
    [{ kind: 'unavailable', status: 503 }, true],
    [{ kind: 'auth' }, false],
    [{ kind: 'forbidden' }, false],
    [{ kind: 'notFound' }, false],
    [{ kind: 'conflict', code: 'x' }, false],
    [{ kind: 'validation' }, false],
    [{ kind: 'aborted' }, false],
  ];
  it.each(cases)('%j -> %p', (e, expected) => {
    expect(isRetryable(e)).toBe(expected);
  });
});

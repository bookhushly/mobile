import {
  REFRESH_AFTER_ERROR_MS,
  liveCodeFromResult,
  nextRefreshMs,
  stillUsable,
  usableUntil,
} from '@/features/customer/domain/liveCode';
import type { TicketCodeBody } from '@/features/customer/schemas/ticketCode';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const body: TicketCodeBody = {
  token: 'BH2.abc',
  format: 2,
  expires_at: 1_760_000_030_000,
  step_seconds: 30,
  ticket: { ticket_type: 'Regular', ticket_index: 1 },
};
const last = { token: 'BH2.old', expiresAt: 1_760_000_000_000 };

describe('liveCodeFromResult', () => {
  it('ok → live', () => {
    expect(liveCodeFromResult(ok(body), null)).toEqual({
      kind: 'live',
      token: 'BH2.abc',
      expiresAt: 1_760_000_030_000,
    });
  });

  it('409 with checked_in_at → admitted at that time', () => {
    const e: ApiError = {
      kind: 'conflict',
      code: 'conflict',
      body: { error: 'Ticket already used', checked_in_at: '2026-10-18T18:42:00Z' },
    };
    expect(liveCodeFromResult(err(e), last)).toEqual({
      kind: 'admitted',
      at: '2026-10-18T18:42:00Z',
    });
  });

  it('409 with an unreadable checked_in_at → admitted, time unknown', () => {
    const e: ApiError = { kind: 'conflict', code: 'conflict', body: { checked_in_at: 42 } };
    expect(liveCodeFromResult(err(e), null)).toEqual({ kind: 'admitted', at: null });
  });

  it('409 without checked_in_at → notConfirmed', () => {
    const e: ApiError = { kind: 'conflict', code: 'conflict', body: { error: 'Not confirmed' } };
    expect(liveCodeFromResult(err(e), last)).toEqual({ kind: 'notConfirmed' });
    expect(liveCodeFromResult(err({ kind: 'conflict', code: 'conflict' }), last)).toEqual({
      kind: 'notConfirmed',
    });
  });

  it.each<ApiError>([{ kind: 'forbidden' }, { kind: 'notFound' }])('%o → notYours', (e) => {
    expect(liveCodeFromResult(err(e), last)).toEqual({ kind: 'notYours' });
  });

  it('429 → rateLimited, keeping the last token', () => {
    expect(liveCodeFromResult(err({ kind: 'rateLimited', retryAfterSec: 12 }), last)).toEqual({
      kind: 'rateLimited',
      retryAfterSec: 12,
      last,
    });
    expect(liveCodeFromResult(err({ kind: 'rateLimited' }), null)).toEqual({
      kind: 'rateLimited',
      retryAfterSec: null,
      last: null,
    });
  });

  it('an expired session (auth) is its own state, not "connect to the internet"', () => {
    expect(liveCodeFromResult(err({ kind: 'auth' }), last)).toEqual({ kind: 'signedOut' });
  });

  it.each<ApiError>([
    { kind: 'network' },
    { kind: 'timeout' },
    { kind: 'unavailable', status: 503 },
    { kind: 'validation' },
    { kind: 'aborted' },
    { kind: 'unknown', status: 418 },
  ])('%o → fallback (never a refusal)', (e) => {
    expect(liveCodeFromResult(err(e), last)).toEqual({ kind: 'fallback' });
  });
});

describe('timing', () => {
  it('refreshes 2 s before expiry on the server clock', () => {
    expect(nextRefreshMs(100_000, 70_000)).toBe(28_000);
  });

  it('waits at least 3 s', () => {
    expect(nextRefreshMs(100_000, 99_000)).toBe(3_000);
    expect(nextRefreshMs(100_000, 200_000)).toBe(3_000);
  });

  it('keeps the last token usable until 30 s past expiry', () => {
    expect(stillUsable(100_000, 129_999)).toBe(true);
    expect(stillUsable(100_000, 130_000)).toBe(false);
    expect(usableUntil(100_000)).toBe(130_000);
  });

  it('retries 15 s after an error', () => {
    expect(REFRESH_AFTER_ERROR_MS).toBe(15_000);
  });
});

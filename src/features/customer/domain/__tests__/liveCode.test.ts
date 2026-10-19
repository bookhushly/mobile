import {
  REFRESH_AFTER_ERROR_MS,
  codesFinal,
  codesFromResult,
  liveCodeFromResult,
  nextRefreshMs,
  stillUsable,
  ticketCodeState,
  usableUntil,
} from '@/features/customer/domain/liveCode';
import type { EventCodes } from '@/features/customer/schemas/actions';
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

describe('booking codes (spec E2)', () => {
  const codes: EventCodes = {
    format: 2,
    expiresAt: 1_760_000_030_000,
    stepSeconds: 30,
    tickets: [
      { id: 't1', type: 'VIP', index: 1, checkedInAt: null, token: 'BH2.one' },
      { id: 't2', type: 'VIP', index: 2, checkedInAt: '2026-11-01T19:30:00Z', token: null },
    ],
  };
  const batch = codesFromResult(ok(codes), null);

  it('maps each ticket: a token is live, a null token is admitted (final)', () => {
    expect(ticketCodeState(batch, 't1')).toEqual({
      kind: 'live',
      token: 'BH2.one',
      expiresAt: 1_760_000_030_000,
    });
    expect(ticketCodeState(batch, 't2')).toEqual({ kind: 'admitted', at: '2026-11-01T19:30:00Z' });
  });

  it('a ticket missing from the answer, or none issued yet, is the fallback', () => {
    expect(ticketCodeState(batch, 't9')).toEqual({ kind: 'fallback' });
    const none = codesFromResult(
      ok({ format: null, expiresAt: null, stepSeconds: 30, tickets: [] }),
      null,
    );
    expect(ticketCodeState(none, 't1')).toEqual({ kind: 'fallback' });
    expect(codesFinal(none)).toBe(false);
  });

  it.each<[string, ApiError, string]>([
    ['409 not_confirmed', { kind: 'conflict', code: 'not_confirmed' }, 'notConfirmed'],
    ['403', { kind: 'forbidden', code: 'forbidden' }, 'notYours'],
    ['404 not_found', { kind: 'notFound', code: 'not_found' }, 'notYours'],
    ['401', { kind: 'auth' }, 'signedOut'],
    ['503', { kind: 'unavailable', status: 503, code: 'unavailable' }, 'fallback'],
    ['network', { kind: 'network' }, 'fallback'],
    ['timeout', { kind: 'timeout' }, 'fallback'],
  ])('%s → %s for every ticket', (_, e, kind) => {
    const s = codesFromResult(err(e), null);
    expect(s.kind).toBe(kind);
    expect(ticketCodeState(s, 't1').kind).toBe(kind);
  });

  it('a 429 keeps each ticket’s last token, and a used one stays admitted', () => {
    const live = batch.kind === 'live' ? batch : null;
    const s = codesFromResult(err({ kind: 'rateLimited', retryAfterSec: 20 }), live);
    expect(ticketCodeState(s, 't1')).toEqual({
      kind: 'rateLimited',
      retryAfterSec: 20,
      last: { token: 'BH2.one', expiresAt: 1_760_000_030_000 },
    });
    expect(ticketCodeState(s, 't2')).toEqual({ kind: 'admitted', at: '2026-11-01T19:30:00Z' });
    expect(ticketCodeState(s, 't9')).toEqual({
      kind: 'rateLimited',
      retryAfterSec: 20,
      last: null,
    });
    const cold = codesFromResult(err({ kind: 'rateLimited' }), null);
    expect(ticketCodeState(cold, 't1')).toEqual({
      kind: 'rateLimited',
      retryAfterSec: null,
      last: null,
    });
  });

  it('is final once refused for good or every ticket is used', () => {
    expect(codesFinal(batch)).toBe(false);
    expect(
      codesFinal(codesFromResult(err({ kind: 'conflict', code: 'not_confirmed' }), null)),
    ).toBe(true);
    expect(codesFinal(codesFromResult(err({ kind: 'forbidden', code: 'forbidden' }), null))).toBe(
      true,
    );
    expect(codesFinal(codesFromResult(err({ kind: 'auth' }), null))).toBe(false);
    const used = codesFromResult(
      ok({
        ...codes,
        tickets: codes.tickets.map((t) => ({ ...t, token: null, checkedInAt: 'x' })),
      }),
      null,
    );
    expect(codesFinal(used)).toBe(true);
  });
});

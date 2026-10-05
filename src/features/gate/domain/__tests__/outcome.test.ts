import {
  classify,
  isTransient,
  mayHaveCommitted,
  replayOf,
  type CouldntCheckCause,
  type RefusalReason,
} from '@/features/gate/domain/outcome';
import { fx } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody } from '@/features/gate/schemas/scan';
import { errorFromResponse, type ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const noHeaders = { get: () => null };
type Fixture = { status: number; body: unknown };
const fail = (f: Fixture) => err(errorFromResponse(f.status, f.body, noHeaders));
const failWith = (e: ApiError) => err(e);
const ctx = { uncertainSince: null };

describe('classify', () => {
  it('a 200 whose body has drifted is still an admission, shown as Ticket', () => {
    const r = admitBody.safeParse({ ok: true, ticket: { id: 5 }, booking: 'x' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(classify(ok(r.data), ctx)).toEqual({
      kind: 'admitted',
      ticketType: null,
      ticketIndex: null,
      totalTickets: null,
      checkedInCount: null,
      checkedInAt: null,
    });
  });
  it('200 → admitted with ticket and booking progress', () => {
    expect(classify(ok(admitBody.parse(fx.admitted.body)), ctx)).toEqual({
      kind: 'admitted',
      ticketType: 'Regular',
      ticketIndex: 2,
      totalTickets: 3,
      checkedInCount: 2,
      checkedInAt: '2026-10-05T18:04:00.000Z',
    });
  });
  it('409 already_checked_in → used, named scanner', () => {
    expect(classify(fail(fx.usedByName), ctx)).toEqual({
      kind: 'used',
      checkedInAt: '2026-10-05T17:30:00.000Z',
      scannedBy: { kind: 'named', name: 'Ada Gate' },
      ticketType: 'Regular',
      replayed: false,
    });
  });
  it('an email in scanned_by is shown as another scanner', () => {
    const o = classify(fail(fx.usedByEmail), ctx);
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'anotherScanner' });
  });
  it('used after an uncertain attempt that started before the check-in → by me', () => {
    const since = Date.parse('2026-10-05T17:29:58.000Z');
    const o = classify(fail(fx.usedByName), { uncertainSince: since });
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'me' });
  });
  it('used long before the uncertain attempt → not by me', () => {
    const since = Date.parse('2026-10-05T18:30:00.000Z');
    const o = classify(fail(fx.usedByName), { uncertainSince: since });
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'named', name: 'Ada Gate' });
  });
  it('server by_me true → by me without any uncertain attempt', () => {
    const o = classify(fail(fx.usedByMe), ctx);
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'me' });
  });
  it('server by_me false → never by me, even inside the uncertain window', () => {
    const since = Date.parse('2026-10-05T17:29:58.000Z');
    const o = classify(fail(fx.usedNotMe), { uncertainSince: since });
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'named', name: 'Ada Gate' });
  });
  it('server by_me null falls back to the uncertain-attempt heuristic', () => {
    const since = Date.parse('2026-10-05T17:29:58.000Z');
    const o = classify(fail({ status: 409, body: { ...fx.usedByName.body, by_me: null } }), {
      uncertainSince: since,
    });
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'me' });
  });
  it('used with an unparseable check-in time after an uncertain attempt → by me', () => {
    const o = classify(
      fail({ status: 409, body: { code: 'already_checked_in', scanned_by: 'Ada Gate' } }),
      { uncertainSince: Date.parse('2026-10-05T18:30:00.000Z') },
    );
    expect(o.kind === 'used' && o.scannedBy).toEqual({ kind: 'me' });
  });
  it.each<[Fixture, RefusalReason, boolean]>([
    [fx.notFound, 'notFound', false],
    [fx.bookingQr, 'oldFormat', false],
    [fx.wrongEvent, 'wrongEvent', false],
    [fx.notConfirmed, 'notConfirmed', false],
    [fx.invalidRotating, 'invalid', false],
    [fx.invalidStatic, 'invalid', false],
    [fx.forbidden, 'notAssigned', false],
    [fx.expiredCode, 'expired', true],
    [fx.staticNotAllowed, 'staticNotAllowed', true],
  ])('refusal %#', (f, reason, fixable) => {
    expect(classify(fail(f), ctx)).toEqual({ kind: 'refused', reason, fixable });
  });
  it('an unknown 409 code is a generic refusal', () => {
    expect(classify(fail({ status: 409, body: { code: 'new_thing' } }), ctx)).toEqual({
      kind: 'refused',
      reason: 'other',
      fixable: false,
    });
  });
  it.each<[Fixture, CouldntCheckCause]>([
    // Codeless 403/404/409 come from an edge, WAF or older deploy, not the scan route.
    [{ status: 403, body: { error: 'Forbidden' } }, 'server'],
    [{ status: 403, body: null }, 'server'],
    [{ status: 403, body: { code: 'waf_block' } }, 'server'],
    [{ status: 404, body: null }, 'server'],
    [{ status: 404, body: { error: 'Not found' } }, 'server'],
    [{ status: 404, body: { code: 'route_missing' } }, 'server'],
    [{ status: 409, body: { error: 'Conflict' } }, 'server'],
    [{ status: 409, body: null }, 'server'],
    [fx.lookupFailed, 'server'],
    [fx.rateLimited, 'rateLimited'],
    [fx.unauthorized, 'auth'],
    [fx.missingId, 'unreadable'],
  ])('transient or unreadable %# → couldntCheck', (f, cause) => {
    expect(classify(fail(f), ctx)).toEqual({ kind: 'couldntCheck', cause });
  });
  it.each<[ApiError, CouldntCheckCause]>([
    [{ kind: 'network' }, 'network'],
    [{ kind: 'aborted' }, 'network'],
    [{ kind: 'timeout' }, 'timeout'],
    [{ kind: 'validation' }, 'unreadable'],
    [{ kind: 'unavailable', status: 502 }, 'server'],
  ])('%o → couldntCheck', (e, cause) => {
    expect(classify(failWith(e), ctx)).toEqual({ kind: 'couldntCheck', cause });
  });
});

describe('transience', () => {
  it('only network, timeout, 429 and 5xx are retried', () => {
    expect(isTransient(failWith({ kind: 'network' }))).toBe(true);
    expect(isTransient(failWith({ kind: 'timeout' }))).toBe(true);
    expect(isTransient(failWith({ kind: 'rateLimited' }))).toBe(true);
    expect(isTransient(failWith({ kind: 'unavailable', status: 503 }))).toBe(true);
    expect(isTransient(failWith({ kind: 'auth' }))).toBe(false);
    expect(isTransient(fail(fx.notFound))).toBe(false);
    expect(isTransient(failWith({ kind: 'validation' }))).toBe(false);
  });
  it('a request that may have reached the database is uncertain; a 429 is not', () => {
    expect(mayHaveCommitted(failWith({ kind: 'timeout' }))).toBe(true);
    expect(mayHaveCommitted(failWith({ kind: 'network' }))).toBe(true);
    expect(mayHaveCommitted(failWith({ kind: 'unavailable', status: 502 }))).toBe(true);
    expect(mayHaveCommitted(failWith({ kind: 'validation' }))).toBe(true);
    expect(mayHaveCommitted(failWith({ kind: 'rateLimited' }))).toBe(false);
    expect(mayHaveCommitted(fail(fx.notFound))).toBe(false);
  });
});

describe('replayOf', () => {
  it('an admission replays as used by this phone', () => {
    const admitted = classify(ok(admitBody.parse(fx.admitted.body)), ctx);
    expect(replayOf(admitted)).toEqual({
      kind: 'used',
      checkedInAt: '2026-10-05T18:04:00.000Z',
      scannedBy: { kind: 'me' },
      ticketType: 'Regular',
      replayed: true,
    });
  });
});

import {
  cancelOutcome,
  claimOutcome,
  refundOutcome,
  reviewOutcome,
  transferOutcome,
} from '@/features/customer/domain/actionOutcome';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const refused = (reason: string) => ({ kind: 'refused', reason });
const all = [cancelOutcome, refundOutcome, transferOutcome, reviewOutcome, claimOutcome];

describe('shared answers', () => {
  it.each([cancelOutcome, refundOutcome, transferOutcome, claimOutcome])(
    'a success passes its body through (%#)',
    (f) => {
      expect(f(ok({ a: 1 }))).toEqual({ kind: 'done', value: { a: 1 } });
    },
  );

  it.each(all)('a 401 after refresh is signed out (%#)', (f) => {
    expect(f(err({ kind: 'auth' }))).toEqual({ kind: 'signedOut' });
  });

  it.each(all)('a 429 is rate limited, with and without a retry hint (%#)', (f) => {
    expect(f(err({ kind: 'rateLimited', retryAfterSec: 30 }))).toEqual({
      kind: 'rateLimited',
      retryAfterSec: 30,
    });
    expect(f(err({ kind: 'rateLimited' }))).toEqual({ kind: 'rateLimited', retryAfterSec: null });
  });

  it.each<ApiError>([
    { kind: 'network' },
    { kind: 'timeout' },
    { kind: 'aborted' },
    { kind: 'validation' },
    { kind: 'unavailable', status: 503, code: 'unavailable' },
    { kind: 'unavailable', status: 503, code: 'claim_failed' },
    { kind: 'unavailable', status: 503, code: 'send_failed' },
    { kind: 'unavailable', status: 500, code: 'cancel_failed' },
    { kind: 'unavailable', status: 503, code: 'fetch_failed' },
    { kind: 'unavailable', status: 500 },
    { kind: 'unknown' },
    { kind: 'unknown', status: 408 },
    { kind: 'unknown', status: 425 },
  ])('transient or unreadable answers are uncertain, never a refusal: %p', (e) => {
    for (const f of all) expect(f(err(e))).toEqual({ kind: 'uncertain' });
  });
});

describe('cancelOutcome', () => {
  it.each<[ApiError, string]>([
    [{ kind: 'conflict', code: 'not_cancellable' }, 'notCancellable'],
    [{ kind: 'unknown', status: 400, code: 'not_cancellable' }, 'notCancellable'],
    [{ kind: 'unknown', status: 400, code: 'event_passed' }, 'eventPassed'],
    [{ kind: 'unknown', status: 400, code: 'check_in_passed' }, 'checkInPassed'],
    [{ kind: 'conflict', code: 'booking_changed' }, 'bookingChanged'],
    [{ kind: 'forbidden', code: 'forbidden' }, 'forbidden'],
    [{ kind: 'forbidden' }, 'forbidden'],
    [{ kind: 'notFound', code: 'not_found' }, 'notFound'],
    [{ kind: 'notFound' }, 'notFound'],
    [{ kind: 'unknown', status: 400 }, 'invalid'],
    [{ kind: 'conflict', code: 'conflict' }, 'invalid'],
  ])('%p → %s', (e, reason) => {
    expect(cancelOutcome(err(e))).toEqual(refused(reason));
  });
});

describe('refundOutcome (no codes: by status)', () => {
  it.each<[ApiError, string]>([
    [{ kind: 'conflict', code: 'conflict' }, 'alreadyRequested'],
    [{ kind: 'unknown', status: 400 }, 'notRefundable'],
    [{ kind: 'forbidden' }, 'notFound'],
    [{ kind: 'notFound' }, 'notFound'],
  ])('%p → %s', (e, reason) => {
    expect(refundOutcome(err(e))).toEqual(refused(reason));
  });
});

describe('transferOutcome (no codes: by status)', () => {
  it.each<[ApiError, string]>([
    [{ kind: 'unknown', status: 400 }, 'notTransferable'],
    [{ kind: 'forbidden' }, 'notFound'],
    [{ kind: 'notFound' }, 'notFound'],
    [{ kind: 'conflict', code: 'conflict' }, 'invalid'],
  ])('%p → %s', (e, reason) => {
    expect(transferOutcome(err(e))).toEqual(refused(reason));
  });
});

describe('reviewOutcome', () => {
  it('a posted review is done', () => {
    expect(reviewOutcome(ok({ data: {} }))).toEqual({ kind: 'done', value: 'posted' });
  });

  it('409 already_reviewed counts as done', () => {
    expect(reviewOutcome(err({ kind: 'conflict', code: 'already_reviewed' }))).toEqual({
      kind: 'done',
      value: 'alreadyReviewed',
    });
  });

  it.each<[ApiError, string]>([
    [{ kind: 'forbidden', code: 'no_completed_booking' }, 'notEligible'],
    [{ kind: 'forbidden' }, 'forbidden'],
    [{ kind: 'unknown', status: 400 }, 'invalid'],
    [{ kind: 'unknown', status: 400, code: 'bad_listing_type' }, 'invalid'],
    [{ kind: 'notFound' }, 'notFound'],
  ])('%p → %s', (e, reason) => {
    expect(reviewOutcome(err(e))).toEqual(refused(reason));
  });
});

describe('claimOutcome', () => {
  it.each<[ApiError, string]>([
    [{ kind: 'unknown', status: 400, code: 'invalid_code' }, 'invalidCode'],
    [{ kind: 'forbidden', code: 'invalid_code' }, 'invalidCode'],
    [{ kind: 'forbidden', code: 'not_customer' }, 'notCustomer'],
    [{ kind: 'forbidden', code: 'email_unverified' }, 'emailUnverified'],
    [{ kind: 'unknown', status: 400, code: 'bad_request' }, 'invalid'],
    [{ kind: 'forbidden' }, 'forbidden'],
  ])('%p → %s', (e, reason) => {
    expect(claimOutcome(err(e))).toEqual(refused(reason));
  });
});

import type { ApiError } from '@/shared/lib/errors';
import { eventCreateOutcome, stayCreateOutcome } from '../createOutcome';

const conflict = (code: string, body: Record<string, unknown> = {}): ApiError => ({
  kind: 'conflict',
  code,
  body: { code, ...body },
});
const bad = (code: string, body: Record<string, unknown> = {}): ApiError => ({
  kind: 'unknown',
  status: 400,
  code,
  body: { code, ...body },
});

describe('stayCreateOutcome', () => {
  it('maps dates_invalid', () => {
    expect(stayCreateOutcome(bad('dates_invalid'), 'hotel')).toEqual({
      kind: 'refused',
      words: 'Choose check-out after check-in, from today',
      field: 'dates',
    });
  });

  it('interpolates min_nights and max_guests', () => {
    expect(stayCreateOutcome(conflict('min_nights', { min_nights: 3 }), 'hotel')).toEqual({
      kind: 'refused',
      words: 'At least 3 nights',
      field: 'minNights',
    });
    expect(stayCreateOutcome(bad('max_guests', { max_guests: 4 }), 'apartment')).toEqual({
      kind: 'refused',
      words: 'Up to 4 guests',
      field: 'maxGuests',
    });
  });

  it('words unavailable by kind', () => {
    expect(stayCreateOutcome(conflict('unavailable'), 'hotel')).toEqual({
      kind: 'refused',
      words: 'No rooms left for these dates',
    });
    expect(stayCreateOutcome(conflict('unavailable'), 'apartment')).toEqual({
      kind: 'refused',
      words: 'These dates were just booked. Try other dates',
    });
  });

  it('maps 404 and not_found', () => {
    const words = "This listing isn't available any more";
    expect(stayCreateOutcome({ kind: 'notFound' }, 'hotel')).toEqual({ kind: 'refused', words });
    expect(stayCreateOutcome({ kind: 'notFound', code: 'not_found' }, 'hotel')).toEqual({
      kind: 'refused',
      words,
    });
  });

  it('in_progress is busy with retry_after, default 2', () => {
    expect(stayCreateOutcome(conflict('in_progress', { retry_after: 5 }), 'hotel')).toEqual({
      kind: 'busy',
      seconds: 5,
    });
    expect(stayCreateOutcome(conflict('in_progress'), 'hotel')).toEqual({
      kind: 'busy',
      seconds: 2,
    });
  });

  it('idempotency_mismatch is unsure', () => {
    expect(stayCreateOutcome(conflict('idempotency_mismatch'), 'hotel')).toEqual({
      kind: 'unsure',
    });
  });

  it('invalid_input uses the first details message, else a fallback', () => {
    expect(
      stayCreateOutcome(
        bad('invalid_input', { details: [{ message: 'Bad phone' }, { message: 'Other' }] }),
        'hotel',
      ),
    ).toEqual({ kind: 'refused', words: 'Bad phone' });
    expect(stayCreateOutcome(bad('invalid_input', { details: ['Plain text'] }), 'hotel')).toEqual({
      kind: 'refused',
      words: 'Plain text',
    });
    expect(stayCreateOutcome(bad('invalid_input'), 'hotel')).toEqual({
      kind: 'refused',
      words: 'Check your details',
    });
  });

  it('unknown 409 uses the body error, else a fallback', () => {
    expect(stayCreateOutcome(conflict('weird', { error: 'Closed for works' }), 'hotel')).toEqual({
      kind: 'refused',
      words: 'Closed for works',
    });
    expect(stayCreateOutcome({ kind: 'conflict', code: 'conflict' }, 'hotel')).toEqual({
      kind: 'refused',
      words: "This can't be booked right now",
    });
  });

  it('503 booking_failed and addons_failed are failed with the stray booking id', () => {
    for (const code of ['booking_failed', 'addons_failed']) {
      expect(
        stayCreateOutcome(
          { kind: 'unavailable', status: 503, code, body: { code, booking_id: 'b-9' } },
          'hotel',
        ),
      ).toEqual({ kind: 'failed', words: "Couldn't book. Try again", strayBookingId: 'b-9' });
    }
    expect(
      stayCreateOutcome({ kind: 'unavailable', status: 503, code: 'booking_failed' }, 'hotel'),
    ).toMatchObject({ kind: 'failed', strayBookingId: null });
  });

  it('uses number-free words when min_nights or max_guests is missing', () => {
    expect(stayCreateOutcome(conflict('min_nights'), 'hotel')).toMatchObject({
      words: 'Choose more nights',
    });
    expect(stayCreateOutcome(bad('max_guests'), 'hotel')).toMatchObject({
      words: 'Too many guests',
    });
  });

  it('forbidden is refused with a generic line', () => {
    expect(stayCreateOutcome({ kind: 'forbidden' }, 'hotel')).toEqual({
      kind: 'refused',
      words: "This can't be booked right now",
    });
    expect(eventCreateOutcome({ kind: 'forbidden' })).toEqual({
      kind: 'refused',
      words: "This can't be booked right now",
    });
  });

  it('429 waits', () => {
    expect(stayCreateOutcome({ kind: 'rateLimited', retryAfterSec: 7 }, 'hotel')).toEqual({
      kind: 'wait',
      seconds: 7,
    });
    expect(stayCreateOutcome({ kind: 'rateLimited' }, 'hotel')).toMatchObject({ kind: 'wait' });
  });

  it('network, timeout, aborted, other 5xx and invalid responses are unsure', () => {
    const errs: ApiError[] = [
      { kind: 'network' },
      { kind: 'timeout' },
      { kind: 'aborted' },
      { kind: 'validation' },
      { kind: 'unavailable', status: 502 },
      { kind: 'unavailable', status: 503, code: 'other' },
    ];
    for (const e of errs) expect(stayCreateOutcome(e, 'hotel')).toEqual({ kind: 'unsure' });
  });

  it('auth is refused with a sign-in prompt', () => {
    expect(stayCreateOutcome({ kind: 'auth' }, 'hotel')).toEqual({
      kind: 'refused',
      words: 'Sign in again to book',
    });
  });
});

describe('eventCreateOutcome', () => {
  it('409 is not enough tickets', () => {
    expect(eventCreateOutcome(conflict('unavailable'))).toEqual({
      kind: 'refused',
      words: 'Not enough tickets left',
    });
  });

  it('404 is not available', () => {
    expect(eventCreateOutcome({ kind: 'notFound' })).toEqual({
      kind: 'refused',
      words: "This listing isn't available any more",
    });
  });

  it('400 uses the body error, else a fallback', () => {
    expect(eventCreateOutcome(bad('x', { error: 'Max 20 tickets' }))).toEqual({
      kind: 'refused',
      words: 'Max 20 tickets',
    });
    expect(eventCreateOutcome({ kind: 'unknown', status: 400 })).toEqual({
      kind: 'refused',
      words: 'Check your tickets',
    });
  });

  it('keeps in_progress and idempotency_mismatch semantics', () => {
    expect(eventCreateOutcome(conflict('in_progress', { retry_after: 4 }))).toEqual({
      kind: 'busy',
      seconds: 4,
    });
    expect(eventCreateOutcome(conflict('idempotency_mismatch'))).toEqual({ kind: 'unsure' });
  });

  it('429 waits; transient and invalid responses are unsure; auth is refused', () => {
    expect(eventCreateOutcome({ kind: 'rateLimited', retryAfterSec: 3 })).toEqual({
      kind: 'wait',
      seconds: 3,
    });
    for (const e of [
      { kind: 'network' },
      { kind: 'timeout' },
      { kind: 'aborted' },
      { kind: 'validation' },
      { kind: 'unavailable', status: 503 },
    ] satisfies ApiError[]) {
      expect(eventCreateOutcome(e)).toEqual({ kind: 'unsure' });
    }
    expect(eventCreateOutcome({ kind: 'auth' })).toEqual({
      kind: 'refused',
      words: 'Sign in again to book',
    });
  });
});

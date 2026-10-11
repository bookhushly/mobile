import {
  checkInFlow,
  initialFlow,
  type FlowState,
} from '@/features/receptionist/domain/checkInFlow';
import { parseCheckInCode, type CheckInCode } from '@/features/receptionist/domain/checkInCode';
import type { BookingRow } from '@/features/receptionist/schemas/desk';

function row(p: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'b1',
    guest_name: 'Ada Obi',
    guest_phone: '+2348031234821',
    check_in_date: '2026-10-11',
    check_out_date: '2026-10-14',
    adults: 2,
    children: 0,
    booking_status: 'confirmed',
    payment_status: 'completed',
    checked_in: false,
    checked_in_at: null,
    checked_out_at: null,
    check_in_code: 'AB12CD34',
    special_requests: null,
    hotel_rooms: null,
    ...p,
  };
}

function code(raw: string): CheckInCode {
  const p = parseCheckInCode(raw);
  if (!p.ok) throw new Error(`bad test code ${raw}`);
  return p.code;
}

const booking = row();
const CODE = code('AB12CD34');
const NOW = Date.parse('2026-10-11T09:42:00Z');
const preview: FlowState = { step: 'preview', booking };
const sending: FlowState = { step: 'sending', booking, sentAt: NOW };
const uncertain: FlowState = { step: 'uncertain', booking, sentAt: NOW };
const rechecking: FlowState = { step: 'rechecking', booking, sentAt: NOW };

describe('submit', () => {
  it('keeps the entry step with the reason for an invalid code', () => {
    expect(checkInFlow(initialFlow, { type: 'submit', raw: 'AB12' })).toEqual({
      step: 'entry',
      error: 'shape',
    });
    expect(checkInFlow(initialFlow, { type: 'submit', raw: '  ' })).toEqual({
      step: 'entry',
      error: 'empty',
    });
  });
  it('names an event ticket scanned at the desk', () => {
    expect(checkInFlow(initialFlow, { type: 'submit', raw: ' bh2.x ' })).toEqual({
      step: 'entry',
      error: 'eventTicket',
    });
  });
  it('starts looking up a valid code from entry', () => {
    expect(checkInFlow(initialFlow, { type: 'submit', raw: 'ab12cd34' })).toEqual({
      step: 'looking',
      code: 'AB12CD34',
    });
  });
  it('starts looking up again from notFound', () => {
    expect(
      checkInFlow({ step: 'notFound', code: CODE }, { type: 'submit', raw: '7F3B9C01' }),
    ).toEqual({ step: 'looking', code: '7F3B9C01' });
  });
  it('starts looking up again from lookupFailed', () => {
    expect(
      checkInFlow({ step: 'lookupFailed', code: CODE }, { type: 'submit', raw: 'AB12CD34' }),
    ).toEqual({ step: 'looking', code: 'AB12CD34' });
  });
  it('is ignored while sending', () => {
    expect(checkInFlow(sending, { type: 'submit', raw: 'AB12CD34' })).toBe(sending);
  });
});

describe('lookup', () => {
  const looking: FlowState = { step: 'looking', code: CODE };
  it('found null → notFound', () => {
    expect(checkInFlow(looking, { type: 'found', booking: null })).toEqual({
      step: 'notFound',
      code: CODE,
    });
  });
  it('found a booking → preview', () => {
    expect(checkInFlow(looking, { type: 'found', booking })).toEqual(preview);
  });
  it('lookupError → lookupFailed', () => {
    expect(checkInFlow(looking, { type: 'lookupError' })).toEqual({
      step: 'lookupFailed',
      code: CODE,
    });
  });
  it('found outside looking is ignored', () => {
    expect(checkInFlow(preview, { type: 'found', booking })).toBe(preview);
  });
});

describe('confirm', () => {
  it('moves preview to sending with the send time', () => {
    expect(checkInFlow(preview, { type: 'confirm', nowMs: NOW })).toEqual(sending);
  });
  it('allows a retry from rateLimited with no known wait', () => {
    expect(
      checkInFlow({ step: 'rateLimited', booking, untilMs: null }, { type: 'confirm', nowMs: NOW }),
    ).toEqual(sending);
  });
  it('allows a retry from rateLimited once the wait has passed', () => {
    expect(
      checkInFlow({ step: 'rateLimited', booking, untilMs: NOW }, { type: 'confirm', nowMs: NOW }),
    ).toEqual(sending);
  });
  it('stays put from rateLimited before the wait has passed', () => {
    const s: FlowState = { step: 'rateLimited', booking, untilMs: NOW + 5_000 };
    expect(checkInFlow(s, { type: 'confirm', nowMs: NOW })).toBe(s);
  });
});

describe('answer', () => {
  it('done → done', () => {
    expect(
      checkInFlow(sending, { type: 'answer', outcome: { kind: 'done', value: {} }, nowMs: NOW }),
    ).toEqual({ step: 'done', booking });
  });
  it('refused alreadyIn → rechecking, keeping the send time (R3)', () => {
    expect(
      checkInFlow(sending, {
        type: 'answer',
        outcome: { kind: 'refused', refusal: { kind: 'alreadyIn', at: null } },
        nowMs: NOW + 1_000,
      }),
    ).toEqual(rechecking);
  });
  it('any other refusal → refused', () => {
    expect(
      checkInFlow(sending, {
        type: 'answer',
        outcome: { kind: 'refused', refusal: { kind: 'unpaid' } },
        nowMs: NOW,
      }),
    ).toEqual({ step: 'refused', booking, refusal: { kind: 'unpaid' } });
  });
  it('uncertain → uncertain, keeping the send time', () => {
    expect(
      checkInFlow(sending, { type: 'answer', outcome: { kind: 'uncertain' }, nowMs: NOW + 9_000 }),
    ).toEqual(uncertain);
  });
  it('rateLimited → rateLimited with the wait end, or null', () => {
    expect(
      checkInFlow(sending, {
        type: 'answer',
        outcome: { kind: 'rateLimited', retryAfterSec: 12 },
        nowMs: NOW,
      }),
    ).toEqual({ step: 'rateLimited', booking, untilMs: NOW + 12_000 });
    expect(
      checkInFlow(sending, {
        type: 'answer',
        outcome: { kind: 'rateLimited', retryAfterSec: null },
        nowMs: NOW,
      }),
    ).toEqual({ step: 'rateLimited', booking, untilMs: null });
  });
  it('signedOut leaves the flow alone', () => {
    expect(
      checkInFlow(sending, { type: 'answer', outcome: { kind: 'signedOut' }, nowMs: NOW }),
    ).toBe(sending);
  });
  it('is ignored outside sending', () => {
    expect(
      checkInFlow(preview, { type: 'answer', outcome: { kind: 'uncertain' }, nowMs: NOW }),
    ).toBe(preview);
  });
});

describe('recheck', () => {
  const reread = row({ booking_status: 'checked_in', checked_in: true });
  it('recheck from uncertain → rechecking', () => {
    expect(checkInFlow(uncertain, { type: 'recheck' })).toEqual(rechecking);
  });
  it('rechecked done → done with the re-read booking', () => {
    expect(
      checkInFlow(rechecking, { type: 'rechecked', booking: reread, reconciled: 'done' }),
    ).toEqual({ step: 'done', booking: reread });
  });
  it('rechecked done without a row keeps the old booking', () => {
    expect(
      checkInFlow(rechecking, { type: 'rechecked', booking: null, reconciled: 'done' }),
    ).toEqual({ step: 'done', booking });
  });
  it('rechecked elsewhere → elsewhere', () => {
    expect(
      checkInFlow(rechecking, { type: 'rechecked', booking: reread, reconciled: 'elsewhere' }),
    ).toEqual({ step: 'elsewhere', booking: reread });
  });
  it('rechecked notDone → preview with the re-read booking', () => {
    const fresh = row({ special_requests: 'Late arrival' });
    expect(
      checkInFlow(rechecking, { type: 'rechecked', booking: fresh, reconciled: 'notDone' }),
    ).toEqual({ step: 'preview', booking: fresh });
  });
  it('recheckError → uncertain with the same send time', () => {
    expect(checkInFlow(rechecking, { type: 'recheckError' })).toEqual(uncertain);
  });
});

describe('bookingChanged', () => {
  const moved = row({ hotel_rooms: null, id: 'b1' });
  it('from preview → preview with the new booking', () => {
    expect(checkInFlow(preview, { type: 'bookingChanged', booking: moved })).toEqual({
      step: 'preview',
      booking: moved,
    });
  });
  it('from refused → preview with the new booking', () => {
    expect(
      checkInFlow(
        { step: 'refused', booking, refusal: { kind: 'roomOccupied', roomNumber: 204 } },
        { type: 'bookingChanged', booking: moved },
      ),
    ).toEqual({ step: 'preview', booking: moved });
  });
});

it('reset returns to entry from anywhere', () => {
  expect(checkInFlow(sending, { type: 'reset' })).toBe(initialFlow);
  expect(checkInFlow({ step: 'done', booking }, { type: 'reset' })).toBe(initialFlow);
});

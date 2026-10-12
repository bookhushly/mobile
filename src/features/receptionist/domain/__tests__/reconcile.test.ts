import {
  reconcileCheckIn,
  reconcileCheckOut,
  reconcileReassign,
} from '@/features/receptionist/domain/reconcile';

const SENT = Date.parse('2026-10-11T09:42:00Z');

describe('reconcileCheckIn', () => {
  it('is done when the booking was checked in after we sent', () => {
    expect(
      reconcileCheckIn(SENT, {
        booking_status: 'checked_in',
        checked_in: true,
        checked_in_at: '2026-10-11T09:42:05Z',
      }),
    ).toBe('done');
  });
  it('allows 60 s of clock skew before calling it someone else', () => {
    expect(
      reconcileCheckIn(SENT, {
        booking_status: 'checked_in',
        checked_in: true,
        checked_in_at: '2026-10-11T09:41:30Z',
      }),
    ).toBe('done');
    expect(
      reconcileCheckIn(SENT, {
        booking_status: 'checked_in',
        checked_in: true,
        checked_in_at: '2026-10-11T09:40:00Z',
      }),
    ).toBe('elsewhere');
  });
  it('still counts as done if the guest has since checked out', () => {
    expect(
      reconcileCheckIn(SENT, {
        booking_status: 'checked_out',
        checked_in: true,
        checked_in_at: '2026-10-11T09:42:05Z',
      }),
    ).toBe('done');
  });
  it('is not done while the booking is still confirmed or missing', () => {
    expect(
      reconcileCheckIn(SENT, {
        booking_status: 'confirmed',
        checked_in: false,
        checked_in_at: null,
      }),
    ).toBe('notDone');
    expect(reconcileCheckIn(SENT, null)).toBe('notDone');
  });
  it('treats an unreadable check-in time on a checked-in row as elsewhere', () => {
    expect(
      reconcileCheckIn(SENT, {
        booking_status: 'checked_in',
        checked_in: true,
        checked_in_at: 'bad',
      }),
    ).toBe('elsewhere');
  });
});

describe('reconcileCheckOut', () => {
  it('is done when the booking was checked out after we sent', () => {
    expect(
      reconcileCheckOut(SENT, {
        booking_status: 'checked_out',
        checked_out_at: '2026-10-11T09:42:03Z',
      }),
    ).toBe('done');
  });
  it('is not done while the guest is still in house', () => {
    expect(reconcileCheckOut(SENT, { booking_status: 'checked_in', checked_out_at: null })).toBe(
      'notDone',
    );
  });
  it('is elsewhere when the check-out happened an hour earlier', () => {
    expect(
      reconcileCheckOut(SENT, {
        booking_status: 'checked_out',
        checked_out_at: '2026-10-11T08:42:00Z',
      }),
    ).toBe('elsewhere');
  });
});

describe('reconcileReassign', () => {
  it('is done when the booking now sits in the target room', () => {
    expect(reconcileReassign({ hotel_rooms: { id: 'r9' } }, 'r9')).toBe('done');
  });
  it('is not done for another room or a missing booking', () => {
    expect(reconcileReassign({ hotel_rooms: { id: 'r1' } }, 'r9')).toBe('notDone');
    expect(reconcileReassign({ hotel_rooms: null }, 'r9')).toBe('notDone');
    expect(reconcileReassign(null, 'r9')).toBe('notDone');
  });
});

it('reconcileCheckIn treats a null status with checked_in true as checked in, like isInHouse', () => {
  expect(
    reconcileCheckIn(SENT, {
      booking_status: null,
      checked_in: true,
      checked_in_at: '2026-10-11T09:42:05Z',
    }),
  ).toBe('done');
  expect(
    reconcileCheckIn(SENT, { booking_status: null, checked_in: false, checked_in_at: null }),
  ).toBe('notDone');
});

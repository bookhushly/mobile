import type { MyBooking } from '@/features/customer/domain/myBookings';
import {
  bookingAction,
  todayBanner,
  type ActionRows,
} from '@/features/customer/domain/todayBanner';

function booking(p: Partial<MyBooking> = {}): MyBooking {
  return {
    kind: 'event',
    id: 'e1',
    title: 'Afrobeats night',
    place: 'Eko Hotel, Lagos',
    start: '2026-10-13',
    end: '2026-10-13',
    time: '19:00',
    status: 'Confirmed',
    tone: 'success',
    paid: true,
    pending: false,
    when: 'today',
    next: 'Today · 7:00 pm',
    imageUrl: null,
    createdAt: null,
    ...p,
  };
}

const ticket = { id: 't1', ticket_type: 'Regular', ticket_index: 1, checked_in_at: null };
const rows = (p: Partial<ActionRows> = {}): ActionRows => ({
  events: [{ id: 'e1', payment_status: 'completed', status: 'confirmed', tickets: [ticket] }],
  hotels: [
    {
      id: 'h1',
      payment_status: 'completed',
      booking_status: 'confirmed',
      check_in_code: 'AB12CD34',
    },
  ],
  ...p,
});
const HOTEL = booking({ kind: 'hotel', id: 'h1', title: 'Harbour Suites', time: '14:00' });

describe('bookingAction', () => {
  it('follows the ticket (C6) and check-in code (C10) rules on fresh rows', () => {
    expect(bookingAction(booking(), rows())).toBe('tickets');
    expect(bookingAction(HOTEL, rows())).toBe('checkInCode');
    expect(bookingAction(booking({ kind: 'apartment', id: 'a1' }), rows())).toBe('open');
    const unpaid = rows({
      events: [{ id: 'e1', payment_status: 'pending', status: 'pending', tickets: [] }],
    });
    expect(bookingAction(booking(), unpaid)).toBe('open');
    expect(bookingAction(booking({ id: 'gone' }), rows())).toBe('open');
  });

  it('a saved (wallet) entry carries tickets or a code only when they were allowed', () => {
    const withTickets = { ...booking(), tickets: [{ id: 't1' }] };
    expect(bookingAction(withTickets, null)).toBe('tickets');
    expect(bookingAction(booking(), null)).toBe('open');
    const withCode = { ...HOTEL, checkInCode: 'AB12CD34' };
    const blankCode = { ...HOTEL, checkInCode: '' };
    expect(bookingAction(withCode, null)).toBe('checkInCode');
    expect(bookingAction(blankCode, null)).toBe('open');
  });
});

describe('todayBanner', () => {
  it('is the first Today booking with a door action, with its line', () => {
    expect(todayBanner([booking()], rows())).toEqual({
      booking: booking(),
      action: 'tickets',
      text: 'Your event starts at 7:00 pm',
    });
    expect(todayBanner([HOTEL], rows())).toEqual({
      booking: HOTEL,
      action: 'checkInCode',
      text: 'Check-in today from 2:00 pm',
    });
  });

  it('skips bookings with nothing to show at the door', () => {
    const apartment = booking({ kind: 'apartment', id: 'a1' });
    const unpaid = booking({ id: 'e2' });
    expect(todayBanner([apartment, unpaid, HOTEL], rows())?.booking.id).toBe('h1');
    // Already in the room: the code isn't needed any more.
    expect(todayBanner([{ ...HOTEL, status: 'Checked in' }], rows())).toBeNull();
  });

  it('untimed bookings get a plain line', () => {
    expect(todayBanner([booking({ time: null })], rows())?.text).toBe('Your event is today');
    expect(todayBanner([{ ...HOTEL, time: null }], rows())?.text).toBe('Your stay starts today');
  });

  it('only today counts, and nothing at all is null', () => {
    expect(todayBanner([booking({ when: 'upcoming' })], rows())).toBeNull();
    expect(todayBanner([], rows())).toBeNull();
  });

  it('offline (no fresh rows) a saved entry with tickets still leads to them', () => {
    expect(todayBanner([booking()], null)).toBeNull();
    const saved = { ...booking(), tickets: [{ id: 't1' }] };
    expect(todayBanner([saved], null)?.action).toBe('tickets');
  });
});

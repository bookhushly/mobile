import type { MyBooking } from '@/features/customer/domain/myBookings';
import { notificationTarget } from '@/features/customer/domain/notificationTarget';
import type { NotificationRow } from '@/features/customer/schemas/notifications';

function n(p: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: 'n1',
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    message: 'See you there',
    data: null,
    link: null,
    read: false,
    created_at: '2026-10-13T10:00:00Z',
    ...p,
  };
}

function mine(kind: MyBooking['kind'], id: string): MyBooking {
  return {
    kind,
    id,
    title: null,
    place: null,
    start: '2026-10-15',
    end: '2026-10-17',
    time: null,
    status: 'Confirmed',
    tone: 'success',
    paid: true,
    pending: false,
    when: 'upcoming',
    next: '',
    imageUrl: null,
    createdAt: '2026-10-01T00:00:00Z',
  };
}
const bookings = [mine('event', 'e1'), mine('hotel', 'h1')];

describe('notificationTarget', () => {
  it('opens a booking named by data.bookingId with that booking’s kind', () => {
    expect(notificationTarget(n({ data: { bookingId: 'h1' } }), bookings)).toEqual({
      kind: 'booking',
      bookingKind: 'hotel',
      id: 'h1',
    });
  });

  it('accepts data.booking_id too', () => {
    expect(notificationTarget(n({ data: { booking_id: 'e1' } }), bookings)).toEqual({
      kind: 'booking',
      bookingKind: 'event',
      id: 'e1',
    });
  });

  it('falls back to the link when the booking is not in my list', () => {
    expect(
      notificationTarget(
        n({ data: { bookingId: 'zz' }, link: '/dashboard/customer/hotels' }),
        bookings,
      ),
    ).toEqual({ kind: 'tab', tab: 'bookings' });
  });

  it('ignores a non-string bookingId', () => {
    expect(notificationTarget(n({ data: { bookingId: 7 } }), bookings)).toBeNull();
  });

  it.each(['/dashboard/customer', '/dashboard/customer/events', '/dashboard/customer/hotels?x=1'])(
    '%s → bookings tab',
    (link) => {
      expect(notificationTarget(n({ link }), bookings)).toEqual({ kind: 'tab', tab: 'bookings' });
    },
  );

  it.each([
    '/dashboard/customer/profile',
    '/dashboard/customer/settings',
    '/settings',
    '/settings/notifications',
  ])('%s → account tab', (link) => {
    expect(notificationTarget(n({ link }), bookings)).toEqual({ kind: 'tab', tab: 'account' });
  });

  it('reads an absolute bookhushly.com link by its path', () => {
    expect(
      notificationTarget(n({ link: 'https://bookhushly.com/dashboard/customer/events' }), bookings),
    ).toEqual({ kind: 'tab', tab: 'bookings' });
  });

  it.each([null, '', '/vendor/dashboard', '/services/abc', '/dashboard/customers', 'Ethereum'])(
    '%p → nothing',
    (link) => {
      expect(notificationTarget(n({ link }), bookings)).toBeNull();
    },
  );
});

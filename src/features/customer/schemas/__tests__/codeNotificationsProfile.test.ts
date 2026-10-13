import { ticketCodeBody } from '@/features/customer/schemas/ticketCode';
import { NOTIFICATION_COLUMNS, notificationRow } from '@/features/customer/schemas/notifications';
import { PROFILE_COLUMNS, profileRow } from '@/features/customer/schemas/profile';

describe('ticketCodeBody', () => {
  const good = {
    token: 'BH2.abc',
    format: 2,
    expires_at: 1_760_000_030_000,
    step_seconds: 30,
    ticket: { ticket_type: 'Regular', ticket_index: 1 },
  };

  it('parses the live-code body', () => {
    expect(ticketCodeBody.safeParse(good).success).toBe(true);
  });

  it('rejects an empty token or an unknown format', () => {
    expect(ticketCodeBody.safeParse({ ...good, token: '' }).success).toBe(false);
    expect(ticketCodeBody.safeParse({ ...good, format: 3 }).success).toBe(false);
  });
});

describe('notificationRow', () => {
  it('parses a row and its data bag', () => {
    const r = notificationRow.safeParse({
      id: 'n1',
      type: 'booking_confirmed',
      title: 'Booking confirmed',
      message: 'See you there',
      data: { bookingId: 'b1', amount: 5000 },
      link: null,
      read: false,
      created_at: '2026-10-13T10:00:00Z',
    });
    expect(r.success).toBe(true);
  });

  it.each([
    ['an array', [1, 2]],
    ['a string', 'legacy'],
    ['a number', 7],
  ])('reads data holding %s as null instead of failing the row', (_label, data) => {
    const r = notificationRow.safeParse({
      id: 'n1',
      type: 'system',
      title: 'Hello',
      message: 'Hi',
      data,
      link: null,
      read: true,
      created_at: '2026-10-13T10:00:00Z',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.data).toBeNull();
  });

  it('reads only the listed columns', () => {
    expect(NOTIFICATION_COLUMNS).toBe('id, type, title, message, data, link, read, created_at');
  });
});

describe('profileRow', () => {
  it('parses a profile with optional fields empty', () => {
    expect(
      profileRow.safeParse({
        id: 'u1',
        email: 'ada@example.com',
        name: 'Ada',
        phone: null,
        state: null,
        address: null,
      }).success,
    ).toBe(true);
  });

  it('never reads password or role', () => {
    expect(PROFILE_COLUMNS).toBe('id, email, name, phone, state, address');
  });
});

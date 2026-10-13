import {
  admittedLine,
  canShowTickets,
  liveOnly,
  staticTicketUrl,
  ticketMeta,
  ticketsOf,
} from '@/features/customer/domain/tickets';
import type { EventBookingRow } from '@/features/customer/schemas/bookings';
import type { IsoDate } from '@/shared/lib/lagosDay';

function ev(p: Partial<EventBookingRow> = {}): EventBookingRow {
  return {
    id: 'e1',
    status: 'confirmed',
    payment_status: 'completed',
    total_amount: 45000,
    booking_date: '2026-10-18',
    booking_time: null,
    guests: 3,
    ticket_details: null,
    seat_assignments: [{ seat: 'A1' }, { seat: null }, { seat: 'A3' }],
    created_at: '2026-10-01T10:00:00Z',
    listing: {
      id: 'l1',
      title: 'Afrobeats night',
      location: 'Lagos',
      media_urls: null,
      event_date: '2026-10-18T00:00:00',
      event_time: null,
      event_end_date: null,
      require_dynamic_ticket: false,
    },
    tickets: [
      { id: 't3', ticket_type: 'VIP', ticket_index: 3, checked_in_at: null },
      { id: 't1', ticket_type: 'Regular', ticket_index: 1, checked_in_at: '2026-10-18T18:42:00Z' },
      { id: 't2', ticket_type: 'Regular', ticket_index: 2, checked_in_at: null },
    ],
    ...p,
  };
}

describe('ticketsOf', () => {
  it('sorts by ticket_index and reads the seat at index-1', () => {
    expect(ticketsOf(ev())).toEqual([
      {
        id: 't1',
        index: 1,
        total: 3,
        type: 'Regular',
        seat: 'A1',
        admittedAt: '2026-10-18T18:42:00Z',
      },
      { id: 't2', index: 2, total: 3, type: 'Regular', seat: null, admittedAt: null },
      { id: 't3', index: 3, total: 3, type: 'VIP', seat: 'A3', admittedAt: null },
    ]);
  });

  it('has no seats without seat_assignments, and no tickets without rows', () => {
    expect(ticketsOf(ev({ seat_assignments: null })).map((t) => t.seat)).toEqual([
      null,
      null,
      null,
    ]);
    expect(ticketsOf(ev({ tickets: null }))).toEqual([]);
  });

  it('treats an empty seat string as no seat', () => {
    expect(ticketsOf(ev({ seat_assignments: [{ seat: '' }] }))[0]?.seat).toBeNull();
  });
});

describe('canShowTickets', () => {
  it('shows paid, confirmed bookings that have ticket rows', () => {
    expect(canShowTickets(ev())).toBe('show');
  });

  it('says issuing when paid and confirmed but no rows yet', () => {
    expect(canShowTickets(ev({ tickets: [] }))).toBe('issuing');
    expect(canShowTickets(ev({ tickets: null }))).toBe('issuing');
  });

  it.each([[{ status: 'pending' as const }], [{ status: null }]])(
    'says issuing while a paid booking is still processing (%o)',
    (p) => {
      expect(canShowTickets(ev({ ...p, tickets: [] }))).toBe('issuing');
      expect(canShowTickets(ev(p))).toBe('issuing');
    },
  );

  it('shows nothing for an unpaid pending booking', () => {
    expect(canShowTickets(ev({ status: 'pending', payment_status: 'pending' }))).toBe('none');
  });

  it.each([
    [{ status: 'cancelled' as const }],
    [{ status: 'completed' as const }],
    [{ payment_status: 'pending' as const }],
    [{ payment_status: 'refunded' as const }],
  ])('shows nothing for %o', (p) => {
    expect(canShowTickets(ev(p))).toBe('none');
    expect(canShowTickets(ev({ ...p, tickets: [] }))).toBe('none');
  });
});

describe('staticTicketUrl', () => {
  it('is the apex printed-ticket link', () => {
    expect(staticTicketUrl('abc-123')).toBe('https://bookhushly.com/t/abc-123');
  });
});

describe('liveOnly', () => {
  it('follows require_dynamic_ticket', () => {
    expect(liveOnly(ev())).toBe(false);
    const l = ev().listing;
    if (l === null) throw new Error('fixture');
    expect(liveOnly(ev({ listing: { ...l, require_dynamic_ticket: true } }))).toBe(true);
  });

  it('is true when the listing is hidden or the flag is unknown (never vouch for a static code)', () => {
    expect(liveOnly(ev({ listing: null }))).toBe(true);
    const l = ev().listing;
    if (l === null) throw new Error('fixture');
    expect(liveOnly(ev({ listing: { ...l, require_dynamic_ticket: null } }))).toBe(true);
  });
});

describe('admittedLine (one wording for the list and the viewer)', () => {
  const today = '2026-10-13' as IsoDate;
  it('today: "Admitted at 7:42 pm"', () => {
    expect(admittedLine('2026-10-13T18:42:00Z', today)).toBe('Admitted at 7:42 pm');
  });
  it('another day: "Admitted on Sat 10 Oct at 7:42 pm"', () => {
    expect(admittedLine('2026-10-10T18:42:00Z', today)).toBe('Admitted on Sat 10 Oct at 7:42 pm');
  });
  it('no or unreadable time: "Admitted"', () => {
    expect(admittedLine(null, today)).toBe('Admitted');
    expect(admittedLine('nope', today)).toBe('Admitted');
  });
});

describe('ticketMeta', () => {
  const t = { id: 't', index: 2, total: 3, type: 'VIP', seat: null, admittedAt: null };
  it('leads with the holder, then the ticket, type and seat', () => {
    expect(ticketMeta(t, 'Ada Obi')).toBe('Ada Obi · Ticket 2 of 3 · VIP');
    expect(ticketMeta({ ...t, seat: 'A12' }, 'Ada Obi')).toBe(
      'Ada Obi · Ticket 2 of 3 · VIP · Seat A12',
    );
  });
  it('no name (offline, blank): starts with the ticket', () => {
    expect(ticketMeta(t, null)).toBe('Ticket 2 of 3 · VIP');
    expect(ticketMeta(t, '  ')).toBe('Ticket 2 of 3 · VIP');
  });
});

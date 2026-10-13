import type { EventBookingRow } from '@/features/customer/schemas/bookings';

// Printed tickets encode the apex web link; the gate reads the UUID from it (never `www`).
const TICKET_ORIGIN = 'https://bookhushly.com';

export type TicketView = {
  id: string;
  index: number;
  total: number;
  type: string;
  seat: string | null;
  admittedAt: string | null;
};

export function ticketsOf(row: EventBookingRow): TicketView[] {
  const tickets = [...(row.tickets ?? [])].sort((a, b) => a.ticket_index - b.ticket_index);
  return tickets.map((t) => {
    const seat = row.seat_assignments?.[t.ticket_index - 1]?.seat;
    return {
      id: t.id,
      index: t.ticket_index,
      total: tickets.length,
      type: t.ticket_type,
      seat: typeof seat === 'string' && seat !== '' ? seat : null,
      admittedAt: t.checked_in_at,
    };
  });
}

/** C6: tickets only for paid, confirmed bookings; "issuing" until the rows exist. */
export function canShowTickets(row: EventBookingRow): 'show' | 'issuing' | 'none' {
  if (row.status !== 'confirmed' || row.payment_status !== 'completed') return 'none';
  return (row.tickets ?? []).length > 0 ? 'show' : 'issuing';
}

export function staticTicketUrl(ticketId: string): string {
  return `${TICKET_ORIGIN}/t/${encodeURIComponent(ticketId)}`;
}

/** C8: true unless the listing says printed codes work. Hidden or unknown → never vouch for a static code. */
export function liveOnly(row: EventBookingRow): boolean {
  return row.listing?.require_dynamic_ticket !== false;
}

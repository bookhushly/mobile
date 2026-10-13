import type { EventBookingRow } from '@/features/customer/schemas/bookings';
import { lagosWhen12, type IsoDate } from '@/shared/lib/lagosDay';

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
  if (row.payment_status !== 'completed') return 'none';
  // Paid but still `pending`/null: the webhook hasn't confirmed it yet, so tickets are on the way.
  if (row.status === 'pending' || row.status === null) return 'issuing';
  if (row.status !== 'confirmed') return 'none';
  return (row.tickets ?? []).length > 0 ? 'show' : 'issuing';
}

export function staticTicketUrl(ticketId: string): string {
  return `${TICKET_ORIGIN}/t/${encodeURIComponent(ticketId)}`;
}

/** C8: true unless the listing says printed codes work. Hidden or unknown → never vouch for a static code. */
export function liveOnly(row: EventBookingRow): boolean {
  return row.listing?.require_dynamic_ticket !== false;
}

/** "Admitted at 7:42 pm" today, "Admitted on Sat 10 Oct at 7:42 pm" otherwise (list and viewer). */
export function admittedLine(at: string | null, today: IsoDate): string {
  const when = at === null ? '' : lagosWhen12(at, today);
  return when === '' ? 'Admitted' : `Admitted ${when}`;
}

/** "Ada Obi · Ticket 2 of 3 · VIP · Seat A12": the holder first, when known. */
export function ticketMeta(t: TicketView, holder: string | null): string {
  return [
    holder?.trim(),
    `Ticket ${String(t.index)} of ${String(t.total)}`,
    t.type,
    t.seat === null ? null : `Seat ${t.seat}`,
  ]
    .filter((p): p is string => typeof p === 'string' && p !== '')
    .join(' · ');
}

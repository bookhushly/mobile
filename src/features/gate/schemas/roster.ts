import { z } from 'zod';

import type { RosterRow } from '@/features/gate/offline/rosterStore';

const nullString = z.string().nullable().catch(null);

// One bad row must not fail the page: it is dropped, and a dropped ticket is refused offline
// ("not in offline list"), which fails closed.
const rosterTicket = z.object({
  id: z.string().min(1),
  ticket_type: nullString,
  ticket_index: z.number().int().nullable().catch(null),
  booking_id: z.string().min(1),
  booking_status: z.string().min(1),
  checked_in_at: z.string().nullable(),
  scanned_by: nullString,
  by_me: z.boolean().nullable().catch(null),
  holder_name: nullString,
  phone_masked: nullString,
  seat: nullString,
});

export const rosterPage = z.object({
  event: z.object({
    id: z.string(),
    title: nullString,
    event_date: nullString,
    // Strict on purpose: guessing false would accept screenshots offline.
    require_dynamic_ticket: z.boolean(),
    total: z.number().int().nonnegative().catch(0),
  }),
  tickets: z.array(z.unknown()),
  next_after: z.string().nullable(),
  server_time: z.string(),
  keys: z
    .array(z.object({ kid: z.string(), publicKey: z.string(), signing: z.boolean().catch(false) }))
    .optional(),
  keys_error: z.boolean().optional(),
  // First page only; null = no PIN. Parsed and bounds-checked later by parseVerifier.
  override: z.unknown().optional(),
});
export type RosterPage = z.infer<typeof rosterPage>;

export function toRosterRows(tickets: unknown[]): { rows: RosterRow[]; dropped: number } {
  const rows: RosterRow[] = [];
  let dropped = 0;
  for (const raw of tickets) {
    const p = rosterTicket.safeParse(raw);
    if (!p.success) {
      dropped += 1;
      continue;
    }
    const r = p.data;
    rows.push({
      id: r.id.toLowerCase(),
      ticketType: r.ticket_type,
      ticketIndex: r.ticket_index,
      bookingId: r.booking_id.toLowerCase(),
      bookingStatus: r.booking_status,
      checkedInAt: r.checked_in_at,
      scannedBy: r.scanned_by,
      byMe: r.by_me,
      holderName: r.holder_name,
      phoneMasked: r.phone_masked,
      seat: r.seat,
    });
  }
  return { rows, dropped };
}

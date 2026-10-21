import { View } from 'react-native';

import { MAX_TICKETS } from '@/features/customer/domain/checkout/selection';
import { plainText } from '@/features/customer/domain/plainText';
import type { EventDetail } from '@/features/customer/schemas/listings';
import { MAX_TICKETS_LINE } from '@/features/customer/ui/checkout/selectWords';
import { TicketTypeRow } from '@/features/customer/ui/TicketTypeRow';
import { space } from '@/shared/theme';
import { Stack, Stepper, Text } from '@/shared/ui';

export type TicketLine = {
  name: string;
  price: number;
  description: string | null;
  /** null: no count is kept, only the per-booking cap applies. */
  remaining: number | null;
  maxPerOrder: number | null;
};

/** The web's key for an event with no packages; the server prices it at the listing's price. */
const STANDARD = 'Standard Ticket';

/** Server prices (`price`, never the early bird: the create route charges `price`). */
export function ticketLinesOf(e: EventDetail): TicketLine[] {
  if (e.ticket_packages.length === 0) {
    const counted = (e.total_tickets ?? 0) > 0 || (e.remaining_tickets ?? 0) > 0;
    return [
      {
        name: STANDARD,
        price: Math.max(0, e.price ?? 0),
        description: null,
        remaining: counted ? (e.remaining_tickets ?? 0) : null,
        maxPerOrder: null,
      },
    ];
  }
  return e.ticket_packages.map((p) => ({
    name: p.name,
    price: Math.max(0, p.price),
    description: plainText(p.description ?? null),
    // The server's stock check reads `remaining ?? total`.
    remaining: p.remaining ?? p.total ?? 0,
    maxPerOrder: p.max_per_order ?? null,
  }));
}

type Props = {
  lines: TicketLine[];
  qty: Record<string, number>;
  /** Tickets chosen across every line. */
  total: number;
  threshold: number;
  /** The event can't be booked now: no steppers. */
  closed: boolean;
  onQty: (name: string, n: number) => void;
};

// Mobbin §2: one row per package with a stepper; "Sold out" replaces it; "{n} left" only at or
// below the organiser's threshold; the 20-ticket cap is said up front (P18).
export function EventTickets({ lines, qty, total, threshold, closed, onQty }: Props) {
  return (
    <Stack gap="s2" testID="tickets">
      <Text variant="headline">Tickets</Text>
      <Text variant="bodySm" tone="textSecondary" testID="max-tickets">
        {MAX_TICKETS_LINE}
      </Text>
      <View>
        {lines.map((l, i) => {
          const n = qty[l.name] ?? 0;
          const soldOut = l.remaining !== null && l.remaining <= 0;
          const max = Math.min(
            MAX_TICKETS,
            l.remaining ?? MAX_TICKETS,
            l.maxPerOrder ?? MAX_TICKETS,
            n + (MAX_TICKETS - total),
          );
          const low = l.remaining !== null && !soldOut && l.remaining <= threshold;
          return (
            <TicketTypeRow
              key={`${String(i)}:${l.name}`}
              ticket={{
                name: l.name,
                price: l.price,
                description: l.description,
                earlyBird: null,
                stock: soldOut ? 'Sold out' : null,
              }}
              stepper={
                soldOut || closed ? null : (
                  <View style={{ alignItems: 'flex-end', gap: space.s1 }}>
                    {low ? (
                      <Text variant="bodySm" tone="warningFg" tabular>
                        {`${String(l.remaining)} left`}
                      </Text>
                    ) : null}
                    <Stepper
                      label={l.name}
                      value={n}
                      min={0}
                      max={Math.max(n, max)}
                      onChange={(next) => {
                        onQty(l.name, next);
                      }}
                      testID={`qty-${l.name}`}
                    />
                  </View>
                )
              }
            />
          );
        })}
      </View>
    </Stack>
  );
}

import { View } from 'react-native';

import { admittedLine, type TicketView } from '@/features/customer/domain/tickets';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { ListRow, SectionHeader, StatusPill } from '@/shared/ui';

function ticketStatus(t: TicketView, today: IsoDate): string {
  return t.admittedAt === null ? 'Valid' : admittedLine(t.admittedAt, today);
}

// C6: one row per ticket, "Valid" or "Admitted at 7:42 pm" (the viewer's wording), with the seat.
export function TicketList({ tickets, today }: { tickets: readonly TicketView[]; today: IsoDate }) {
  if (tickets.length === 0) return null;
  return (
    <View>
      <SectionHeader label="Tickets" count={tickets.length} />
      {tickets.map((t) => {
        const status = ticketStatus(t, today);
        const title = `Ticket ${String(t.index)} · ${t.type}`;
        const seat = t.seat === null ? undefined : `Seat ${t.seat}`;
        return (
          <ListRow
            key={t.id}
            title={title}
            subtitle={seat}
            accessibilityLabel={[title, seat, status].filter(Boolean).join(', ')}
            trailing={
              <StatusPill
                tone={t.admittedAt === null ? 'success' : 'neutral'}
                label={status}
                size="sm"
              />
            }
          />
        );
      })}
    </View>
  );
}

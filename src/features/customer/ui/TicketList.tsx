import { View } from 'react-native';

import { clockLabel } from '@/features/customer/domain/myBookings';
import type { TicketView } from '@/features/customer/domain/tickets';
import { lagosTime } from '@/shared/lib/lagosDay';
import { ListRow, SectionHeader, StatusPill } from '@/shared/ui';

function ticketStatus(t: TicketView): string {
  if (t.admittedAt === null) return 'Valid';
  const at = clockLabel(lagosTime(t.admittedAt));
  return at === null ? 'Admitted' : `Admitted ${at}`;
}

// C6: one row per ticket, "Valid" or "Admitted 7:42 pm", with the seat when there is one.
export function TicketList({ tickets }: { tickets: readonly TicketView[] }) {
  if (tickets.length === 0) return null;
  return (
    <View>
      <SectionHeader label="Tickets" count={tickets.length} />
      {tickets.map((t) => {
        const status = ticketStatus(t);
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

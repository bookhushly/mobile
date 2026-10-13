import { Ticket } from 'lucide-react-native';

import { eventWhen, packagesLine } from '@/features/customer/domain/detailText';
import { fromEvent } from '@/features/customer/domain/myBookings';
import { canShowTickets, ticketsOf } from '@/features/customer/domain/tickets';
import type { EventBookingRow } from '@/features/customer/schemas/bookings';
import { BookingFrame } from '@/features/customer/ui/BookingFrame';
import { DetailRows } from '@/features/customer/ui/DetailRows';
import { openMaps } from '@/features/customer/ui/links';
import { TicketList } from '@/features/customer/ui/TicketList';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { Banner, Button } from '@/shared/ui';

type Props = {
  row: EventBookingRow;
  today: IsoDate;
  onBack: () => void;
  onRefresh: () => Promise<unknown>;
  onShowTickets: (bookingId: string) => void;
};

// C12 event: date and time, venue (→ Maps), packages, tickets, Show tickets.
export function EventDetails({ row, today, onBack, onRefresh, onShowTickets }: Props) {
  const b = fromEvent(row, today);
  const tickets = canShowTickets(row);
  const place = b.place;
  return (
    <BookingFrame
      booking={b}
      onBack={onBack}
      onRefresh={onRefresh}
      notice={
        tickets === 'issuing' ? (
          <Banner tone="neutral" message="Your tickets are being issued — pull to refresh" />
        ) : null
      }
      footer={
        tickets === 'show' ? (
          <Button
            label="Show tickets"
            icon={Ticket}
            onPress={() => {
              onShowTickets(row.id);
            }}
          />
        ) : undefined
      }
    >
      <DetailRows
        rows={[
          { label: 'Date', value: eventWhen(b.start, b.end, b.time) },
          place === null
            ? null
            : {
                label: 'Venue',
                value: place,
                onPress: () => {
                  openMaps(place);
                },
              },
          { label: 'Packages', value: packagesLine(row.ticket_details) ?? '' },
        ]}
      />
      {tickets === 'show' ? <TicketList tickets={ticketsOf(row)} /> : null}
    </BookingFrame>
  );
}

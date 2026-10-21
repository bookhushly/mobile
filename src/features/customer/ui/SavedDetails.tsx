import { QrCode, Ticket } from 'lucide-react-native';

import { dayAt, eventWhen } from '@/features/customer/domain/detailText';
import type { WalletEntry } from '@/features/customer/offline/wallet';
import { BookingFrame } from '@/features/customer/ui/BookingFrame';
import { DetailRows } from '@/features/customer/ui/DetailRows';
import { openMaps } from '@/features/customer/ui/links';
import { savedAtLabel } from '@/features/customer/ui/savedAt';
import { TicketList } from '@/features/customer/ui/TicketList';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { Banner, Button } from '@/shared/ui';

type Props = {
  entry: WalletEntry;
  /** The signed-in customer: a payment this device started shows as being checked (P21). */
  userId: string;
  savedAt: number | null;
  onBack: () => void;
  onRefresh: () => Promise<unknown>;
  onShowTickets: (bookingId: string) => void;
  onShowCheckInCode: (bookingId: string) => void;
};

// C9/C17: the network load failed, so the saved copy shows: dates, place, tickets, check-in code.
export function SavedDetails({
  entry: e,
  userId,
  savedAt,
  onBack,
  onRefresh,
  onShowTickets,
  onShowCheckInCode,
}: Props) {
  const place = e.place;
  const tickets = e.tickets ?? [];
  const code = e.checkInCode ?? null;
  const saved =
    savedAt === null
      ? 'Showing saved details. Pull to refresh.'
      : `Showing saved details — last updated ${savedAtLabel(savedAt, clock.serverNow())}. Pull to refresh.`;
  let footer;
  if (e.kind === 'event' && tickets.length > 0)
    footer = (
      <Button
        label="Show tickets"
        icon={Ticket}
        onPress={() => {
          onShowTickets(e.id);
        }}
      />
    );
  else if (e.kind === 'hotel' && code !== null && code !== '')
    footer = (
      <Button
        label="Show check-in code"
        icon={QrCode}
        onPress={() => {
          onShowCheckInCode(e.id);
        }}
      />
    );
  return (
    <BookingFrame
      booking={e}
      userId={userId}
      saved
      onBack={onBack}
      onRefresh={onRefresh}
      notice={<Banner tone="neutral" message={saved} />}
      footer={footer}
    >
      <DetailRows
        rows={[
          ...(e.kind === 'event'
            ? [{ label: 'Date', value: eventWhen(e.start, e.end, e.time) }]
            : [
                { label: 'Check-in', value: dayAt(e.start, e.time, 'from') },
                { label: 'Check-out', value: dayAt(e.end, null) },
              ]),
          place === null
            ? null
            : {
                label: e.kind === 'event' ? 'Venue' : 'Area',
                value: place,
                onPress: () => {
                  openMaps(place);
                },
              },
        ]}
      />
      {e.kind === 'event' ? (
        <TicketList tickets={tickets} today={lagosToday(clock.serverNow())} />
      ) : null}
    </BookingFrame>
  );
}

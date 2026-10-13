import { useIsFocused } from 'expo-router';
import { SearchX, Ticket } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { eventWhen } from '@/features/customer/domain/detailText';
import { fromEvent, kindWord, type MyBooking } from '@/features/customer/domain/myBookings';
import { pagerIndexParam } from '@/features/customer/domain/routeParams';
import {
  canShowTickets,
  liveOnly,
  ticketsOf,
  type TicketView,
} from '@/features/customer/domain/tickets';
import { useBooking } from '@/features/customer/hooks/useBooking';
import { CodeSheet } from '@/features/customer/ui/CodeSheet';
import { savedAtLabel } from '@/features/customer/ui/savedAt';
import { TicketPager } from '@/features/customer/ui/TicketPager';
import { clock } from '@/shared/api/instance';
import { useBrightScreen } from '@/shared/platform/useBrightScreen';
import { usePreventCapture } from '@/shared/platform/usePreventCapture';
import { space } from '@/shared/theme';
import { Banner, EmptyState, ErrorState, SkeletonRows } from '@/shared/ui';

type Props = {
  userId: string;
  /** null: the route param wasn't a UUID. */
  bookingId: string | null;
  /** The raw `index` route param (0-based page). */
  index: unknown;
  onClose: () => void;
};

type Shown = { booking: MyBooking; tickets: TicketView[]; liveOnly: boolean; saved: boolean };

function Body({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, paddingHorizontal: space.s5 }}>{children}</View>;
}

function NotYours({ onClose }: { onClose: () => void }) {
  return (
    <CodeSheet title="Tickets" onClose={onClose}>
      <Body>
        <EmptyState icon={SearchX} title="This booking isn't on your account" />
      </Body>
    </CodeSheet>
  );
}

function EventTickets({ userId, id, index, onClose }: Props & { id: string }) {
  const b = useBooking(userId, 'event', id);
  const focused = useIsFocused();
  let shown: Shown | null = null;
  let none: 'issuing' | 'none' | null = null;
  if (b.row !== undefined && b.row !== null) {
    const can = canShowTickets(b.row);
    if (can === 'show')
      shown = {
        booking: fromEvent(b.row, b.today),
        tickets: ticketsOf(b.row),
        liveOnly: liveOnly(b.row),
        saved: false,
      };
    else none = can;
  } else if (b.row === undefined && b.fromWallet !== null) {
    // Offline (C9): the saved tickets. A missing flag never vouches for a printed code (C8).
    const tickets = b.fromWallet.tickets ?? [];
    if (b.fromWallet.kind === 'event' && tickets.length > 0)
      shown = {
        booking: b.fromWallet,
        tickets,
        liveOnly: b.fromWallet.liveOnly ?? true,
        saved: true,
      };
    else none = 'none';
  }
  // Full brightness and awake only while the codes are on screen (leaving restores both).
  useBrightScreen(focused && shown !== null);

  if (b.row === null) return <NotYours onClose={onClose} />;
  if (shown !== null) {
    const { booking: e } = shown;
    const note = !shown.saved
      ? undefined
      : b.savedAt === null
        ? 'Showing saved tickets.'
        : `Showing saved tickets — last updated ${savedAtLabel(b.savedAt, clock.serverNow())}.`;
    return (
      <CodeSheet
        title={e.title ?? kindWord('event')}
        subtitle={eventWhen(e.start, e.end, e.time)}
        onClose={onClose}
        notice={note === undefined ? undefined : <Banner tone="neutral" message={note} />}
      >
        <TicketPager
          tickets={shown.tickets}
          liveOnly={shown.liveOnly}
          today={b.today}
          start={pagerIndexParam(index, shown.tickets.length)}
        />
      </CodeSheet>
    );
  }
  let body: ReactNode;
  if (none === 'issuing')
    body = (
      <EmptyState
        icon={Ticket}
        title="Your tickets are being issued"
        message="They'll show here in a moment."
      />
    );
  else if (none === 'none') body = <EmptyState icon={Ticket} title="No tickets for this booking" />;
  else if (b.error)
    body = (
      <ErrorState
        title="Couldn't load your tickets"
        message="Check the connection and try again."
        onRetry={() => {
          void b.refetch();
        }}
      />
    );
  else body = <SkeletonRows count={3} />;
  return (
    <CodeSheet title="Tickets" onClose={onClose}>
      <Body>{body}</Body>
    </CodeSheet>
  );
}

// C7/C8/C11: the event's tickets, full screen, for the door.
export function TicketsScreen(props: Props) {
  // With the live clock, the second anti-screenshot measure (C11): no captures while open.
  usePreventCapture('ticket-qr');
  if (props.bookingId === null) return <NotYours onClose={props.onClose} />;
  return <EventTickets key={props.bookingId} {...props} id={props.bookingId} />;
}

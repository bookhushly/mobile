import { SearchX } from 'lucide-react-native';
import type { ReactNode } from 'react';

import type { BookingKind } from '@/features/customer/domain/myBookings';
import { useBooking } from '@/features/customer/hooks/useBooking';
import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';
import { ApartmentDetails } from '@/features/customer/ui/ApartmentDetails';
import type { ActionTarget } from '@/features/customer/ui/actionTarget';
import { BookingActions } from '@/features/customer/ui/BookingActions';
import { BookingFrame } from '@/features/customer/ui/BookingFrame';
import { EventDetails } from '@/features/customer/ui/EventDetails';
import { HotelDetails } from '@/features/customer/ui/HotelDetails';
import { SavedDetails } from '@/features/customer/ui/SavedDetails';
import { ErrorState, SkeletonRows } from '@/shared/ui';

type Handlers = {
  onBack: () => void;
  onShowTickets: (bookingId: string) => void;
  onShowCheckInCode: (bookingId: string) => void;
  /** After a transfer: back to Bookings (the booking is no longer this user's). */
  onTransferred: () => void;
};
type Props = Handlers & {
  userId: string;
  /** The session email (a transfer never goes to it). */
  email: string;
  /** null: the route params weren't a booking kind and UUID. */
  booking: { kind: BookingKind; id: string } | null;
};

function NotYours({ onBack }: { onBack: () => void }) {
  return (
    <NoticeScreen
      title="Booking"
      icon={SearchX}
      heading="This booking isn’t on your account"
      onBack={onBack}
    />
  );
}

type Loaded<R> = ReturnType<typeof useBooking> & { row: R | null | undefined };

// Fresh row → its details; no such row (RLS) → not yours; failed with a saved copy → that copy;
// failed without one → error; else loading. A failure never reads as "not yours" (C17).
function settle<R>(b: Loaded<R>, h: Handlers, details: (row: R) => ReactNode): ReactNode {
  if (b.row !== undefined && b.row !== null) return details(b.row);
  if (b.row === null) return <NotYours onBack={h.onBack} />;
  if (b.fromWallet !== null)
    return (
      <SavedDetails
        entry={b.fromWallet}
        savedAt={b.savedAt}
        onBack={h.onBack}
        onRefresh={b.refetch}
        onShowTickets={h.onShowTickets}
        onShowCheckInCode={h.onShowCheckInCode}
      />
    );
  return (
    <BookingFrame onBack={h.onBack} onRefresh={b.refetch}>
      {b.error ? (
        <ErrorState
          title="Couldn’t load this booking"
          message="Check your connection and try again."
          onRetry={() => {
            void b.refetch();
          }}
        />
      ) : (
        <SkeletonRows count={5} />
      )}
    </BookingFrame>
  );
}

type One = Handlers & { userId: string; email: string; id: string };

function manage(p: One, target: ActionTarget, today: string): ReactNode {
  return (
    <BookingActions
      userId={p.userId}
      email={p.email}
      target={target}
      today={today}
      onTransferred={p.onTransferred}
    />
  );
}

function EventBooking(p: One) {
  const { userId, id, ...h } = p;
  const b = useBooking(userId, 'event', id);
  return settle(b, h, (row) => (
    <EventDetails
      row={row}
      today={b.today}
      onBack={h.onBack}
      onRefresh={b.refetch}
      onShowTickets={h.onShowTickets}
      manage={manage(p, { kind: 'event', row }, b.today)}
    />
  ));
}

function HotelBooking(p: One) {
  const { userId, id, ...h } = p;
  const b = useBooking(userId, 'hotel', id);
  return settle(b, h, (row) => (
    <HotelDetails
      row={row}
      today={b.today}
      onBack={h.onBack}
      onRefresh={b.refetch}
      onShowCheckInCode={h.onShowCheckInCode}
      manage={manage(p, { kind: 'hotel', row }, b.today)}
    />
  ));
}

function ApartmentBooking(p: One) {
  const { userId, id, ...h } = p;
  const b = useBooking(userId, 'apartment', id);
  return settle(b, h, (row) => (
    <ApartmentDetails
      row={row}
      today={b.today}
      onBack={h.onBack}
      onRefresh={b.refetch}
      manage={manage(p, { kind: 'apartment', row }, b.today)}
    />
  ));
}

// C12: one booking's details, per kind.
export function BookingScreen({ userId, email, booking, ...h }: Props) {
  if (booking === null) return <NotYours onBack={h.onBack} />;
  switch (booking.kind) {
    case 'event':
      return <EventBooking key={booking.id} userId={userId} email={email} id={booking.id} {...h} />;
    case 'hotel':
      return <HotelBooking key={booking.id} userId={userId} email={email} id={booking.id} {...h} />;
    case 'apartment':
      return (
        <ApartmentBooking key={booking.id} userId={userId} email={email} id={booking.id} {...h} />
      );
  }
}

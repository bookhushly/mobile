import { ArrowLeft, SearchX } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { viewBooking } from '@/features/receptionist/domain/bookingState';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useBooking } from '@/features/receptionist/hooks/useBooking';
import { BookingActions, type BookingActionHandlers } from '@/features/receptionist/ui/BookingDetail';
import { BookingSummary } from '@/features/receptionist/ui/BookingSummary';
import { EmptyState, ErrorState, Header, IconButton, Screen, SkeletonRows } from '@/shared/ui';

type Props = BookingActionHandlers & { id: string; onBack: () => void };

// `/booking/[id]` on phones (tablets show the same parts in the Guests right pane).
export function BookingScreen({ id, onBack, onChooseRoom, onCheckOut }: Props) {
  const { hotel, today } = useDesk();
  const { booking, error, refetch } = useBooking(id);

  let body: ReactNode;
  let footer: ReactNode;
  if (booking === null) {
    body = <EmptyState icon={SearchX} title={`This booking isn't at ${hotel.name}`} />;
  } else if (booking === undefined) {
    body = error ? (
      <ErrorState
        title="Couldn't load this booking"
        message="Check the connection and try again."
        onRetry={refetch}
      />
    ) : (
      <SkeletonRows count={5} />
    );
  } else {
    const view = viewBooking(booking, today);
    body = <BookingSummary booking={booking} view={view} />;
    footer = (
      <BookingActions
        booking={booking}
        view={view}
        onChooseRoom={onChooseRoom}
        onCheckOut={onCheckOut}
      />
    );
  }

  return (
    <Screen
      scroll
      header={
        <Header
          title="Booking"
          subtitle={hotel.name}
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
      footer={footer}
    >
      {body}
    </Screen>
  );
}

import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { stayErrorWords, useBooking, useMoveBooking } from '@/features/vendor/hooks/useListings';
import { VendorError } from '@/features/vendor/hooks/useVendorRequests';

import { BookingScreen } from '@/features/vendor/screens/BookingScreen';

import { useWho } from '@/features/vendor/hooks/useVendorScreen';

export function VendorBooking({ id, onBack }: { id: string; onBack: () => void }) {
  const { switchToDesk } = useVendorSession();
  const who = useWho();
  const q = useBooking(who, id);
  const move = useMoveBooking(who, id);
  return (
    <BookingScreen
      busy={move.isPending}
      problem={move.isError ? stayErrorWords(move.error) : null}
      onBack={onBack}
      onFrontDesk={switchToDesk}
      onMove={(from, to) => {
        if (move.isPending) return;
        move.mutate({ from, to });
      }}
      state={
        q.isPending
          ? { status: 'loading' }
          : q.isError
            ? {
                status: 'error',
                notFound: q.error instanceof VendorError && q.error.kind === 'notFound',
                retry: () => void q.refetch(),
              }
            : { status: 'ready', booking: q.data }
      }
    />
  );
}

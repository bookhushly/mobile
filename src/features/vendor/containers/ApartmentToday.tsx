import {
  stayErrorWords,
  useBookings,
  useMoveAnyBooking,
} from '@/features/vendor/hooks/useListings';

import { ApartmentTodayScreen } from '@/features/vendor/screens/ApartmentTodayScreen';

import { useLoad, useTop, useWho, type TodayNav } from '@/features/vendor/hooks/useVendorScreen';

export function ApartmentToday({ onOpenBookings, onOpenBooking }: TodayNav) {
  const who = useWho();
  const state = useLoad(useBookings(who));
  const move = useMoveAnyBooking(who);
  return (
    <ApartmentTodayScreen
      top={useTop()}
      state={state}
      busyId={move.isPending ? move.variables.id : null}
      problem={move.isError ? stayErrorWords(move.error) : null}
      onAnswer={(b, confirm) => {
        if (move.isPending) return;
        // Confirming is one tap; declining asks first, on the booking itself.
        if (confirm) move.mutate({ id: b.id, from: b.status, to: 'confirmed' });
        else onOpenBooking(b.id);
      }}
      onOpenBookings={onOpenBookings}
    />
  );
}

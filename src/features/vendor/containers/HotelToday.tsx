import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { useBookings } from '@/features/vendor/hooks/useListings';

import { HotelTodayScreen } from '@/features/vendor/screens/HotelTodayScreen';

import { useLoad, useTop, useWho, type TodayNav } from '@/features/vendor/hooks/useVendorScreen';

export function HotelToday({ onOpenBookings, onOpenBooking }: TodayNav) {
  const { switchToDesk } = useVendorSession();
  const state = useLoad(useBookings(useWho()));
  return (
    <HotelTodayScreen
      top={useTop()}
      state={state}
      onCheckIn={switchToDesk}
      onOpenBookings={onOpenBookings}
      onOpenBooking={(b) => {
        onOpenBooking(b.id);
      }}
    />
  );
}

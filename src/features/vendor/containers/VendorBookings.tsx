import { useState } from 'react';

import type { BookingTab, ListingBooking } from '@/features/vendor/domain/listings';

import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { useBookings } from '@/features/vendor/hooks/useListings';

import { BookingsScreen } from '@/features/vendor/screens/BookingsScreen';

import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { useLoad, useWho } from '@/features/vendor/hooks/useVendorScreen';

export function VendorBookings({ onOpen }: { onOpen: (b: ListingBooking) => void }) {
  const { vendor } = useVendorSession();
  const kind = vendor.kind === 'hotel' ? 'hotel' : 'apartment';
  const load = useLoad(useBookings(useWho()));
  const [tab, setTab] = useState<BookingTab>(kind === 'apartment' ? 'toConfirm' : 'upcoming');
  return (
    <BookingsScreen
      kind={kind}
      today={lagosToday(clock.serverNow())}
      tab={tab}
      onTab={setTab}
      onOpen={onOpen}
      state={load.status === 'ready' ? { ...load, bookings: load.data } : load}
    />
  );
}

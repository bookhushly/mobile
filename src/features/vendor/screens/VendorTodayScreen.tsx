import { useState } from 'react';

import { isQuoteKind } from '@/features/vendor/domain/vendorProfile';
import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { useVendorToday } from '@/features/vendor/hooks/useVendorToday';
import { QuoteTodayScreen } from '@/features/vendor/screens/QuoteTodayScreen';
import {
  ApartmentToday,
  EventToday,
  HotelToday,
} from '@/features/vendor/screens/VendorListingContainers';
import { KIND_WORD } from '@/features/vendor/ui/kindWords';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';

type Nav = {
  onOpenRequests: () => void;
  onOpenRequest: (id: string) => void;
  onOpenJobs: () => void;
  onOpenJob: (id: string) => void;
  onOpenEarnings: () => void;
  onOpenBookings: () => void;
  onOpenBooking: (id: string) => void;
  onOpenEvents: () => void;
};

function QuoteToday({ onOpenRequests, onOpenRequest, onOpenJobs, onOpenJob, onOpenEarnings }: Nav) {
  const { vendor } = useVendorSession();
  const q = useVendorToday(vendor.id, vendor.kind);
  const [refreshing, setRefreshing] = useState(false);
  const nowMs = clock.serverNow();
  return (
    <QuoteTodayScreen
      businessName={vendor.name}
      kindWord={KIND_WORD[vendor.kind]}
      today={lagosToday(nowMs)}
      nowMs={nowMs}
      state={
        q.isPending
          ? { status: 'loading' }
          : q.isError
            ? { status: 'error', retry: () => void q.refetch() }
            : {
                status: 'ready',
                data: q.data,
                refreshing,
                refresh: () => {
                  setRefreshing(true);
                  void q.refetch().finally(() => {
                    setRefreshing(false);
                  });
                },
              }
      }
      onOpenRequests={onOpenRequests}
      onOpenRequest={(r) => {
        onOpenRequest(r.id);
      }}
      onOpenJobs={onOpenJobs}
      onOpenJob={(j) => {
        onOpenJob(j.id);
      }}
      onOpenEarnings={onOpenEarnings}
    />
  );
}

/** Today for the signed-in business: each kind gets its own. */
export function VendorTodayScreen(nav: Nav) {
  const { vendor } = useVendorSession();
  if (isQuoteKind(vendor.kind)) return <QuoteToday {...nav} />;
  switch (vendor.kind) {
    case 'hotel':
      return <HotelToday {...nav} />;
    case 'apartment':
      return <ApartmentToday {...nav} />;
    case 'event':
      return <EventToday {...nav} />;
  }
}

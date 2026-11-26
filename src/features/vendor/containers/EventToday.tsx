import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { useEvents } from '@/features/vendor/hooks/useListings';

import { EventTodayScreen } from '@/features/vendor/screens/EventTodayScreen';

import { useLoad, useTop, useWho, type TodayNav } from '@/features/vendor/hooks/useVendorScreen';

export function EventToday({ onOpenEvents }: TodayNav) {
  const { switchToGate } = useVendorSession();
  const state = useLoad(useEvents(useWho()));
  return (
    <EventTodayScreen
      top={useTop()}
      state={state}
      onScan={switchToGate}
      onOpenEvents={onOpenEvents}
    />
  );
}

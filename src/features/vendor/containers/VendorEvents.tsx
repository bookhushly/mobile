import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { useEvents } from '@/features/vendor/hooks/useListings';

import { EventsScreen } from '@/features/vendor/screens/EventsScreen';

import { clock } from '@/shared/api/instance';

import { useLoad, useWho } from '@/features/vendor/hooks/useVendorScreen';

export function VendorEvents() {
  const { openWeb } = useVendorSession();
  const load = useLoad(useEvents(useWho()));
  return (
    <EventsScreen
      nowMs={clock.serverNow()}
      onManage={() => {
        openWeb('/vendor/dashboard/event-management');
      }}
      state={load.status === 'ready' ? { ...load, events: load.data } : load}
    />
  );
}

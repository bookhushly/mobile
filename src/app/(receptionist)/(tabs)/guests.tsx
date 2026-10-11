import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { GuestsScreen } from '@/features/receptionist/screens/GuestsScreen';

const tabParam = z.enum(['arriving', 'inHouse', 'leaving']).catch('arriving');

export default function GuestsRoute() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = tabParam.parse(params.tab);
  return (
    <GuestsScreen
      tab={tab}
      onTabChange={(next) => {
        router.setParams({ tab: next });
      }}
      onOpenBooking={(id) => {
        router.push({ pathname: '/booking/[id]', params: { id } });
      }}
    />
  );
}

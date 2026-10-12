import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { ROOM_STATUSES } from '@/features/receptionist/schemas/desk';
import { RoomsScreen } from '@/features/receptionist/screens/RoomsScreen';

// Today's "free rooms" opens '/rooms?filter=available'; anything unknown shows every room.
const filterParam = z.enum(['all', ...ROOM_STATUSES]).catch('all');

export default function RoomsRoute() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const filter = filterParam.parse(params.filter);
  return (
    <RoomsScreen
      filter={filter}
      onFilterChange={(next) => {
        router.setParams({ filter: next });
      }}
      onOpenBooking={(id) => {
        router.push({ pathname: '/booking/[id]', params: { id } });
      }}
    />
  );
}

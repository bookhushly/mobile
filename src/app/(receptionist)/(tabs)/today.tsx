import { router } from 'expo-router';

import { TodayScreen } from '@/features/receptionist/screens/TodayScreen';

export default function TodayRoute() {
  return (
    <TodayScreen
      onOpenGuests={(tab) => {
        router.push({ pathname: '/guests', params: { tab } });
      }}
      onOpenFreeRooms={() => {
        router.push({ pathname: '/rooms', params: { filter: 'available' } });
      }}
      onOpenBooking={(id) => {
        router.push({ pathname: '/booking/[id]', params: { id } });
      }}
    />
  );
}

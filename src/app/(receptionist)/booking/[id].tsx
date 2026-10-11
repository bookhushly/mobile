import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { BookingScreen } from '@/features/receptionist/screens/BookingScreen';

// Any non-empty id: an unknown or malformed one reads as "isn't at this hotel" / a load error.
const idParam = z.string().trim().min(1).catch('');

export default function BookingRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = idParam.parse(params.id);
  return (
    <BookingScreen
      id={id}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/guests');
      }}
    />
  );
}

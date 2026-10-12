import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { z } from 'zod';

import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { BookingScreen } from '@/features/receptionist/screens/BookingScreen';
import { CheckOutSheet } from '@/features/receptionist/ui/CheckOutSheet';
import { ChooseRoomSheet } from '@/features/receptionist/ui/ChooseRoomSheet';

// Any non-empty id: an unknown or malformed one reads as "isn't at this hotel" / a load error.
const idParam = z.string().trim().min(1).catch('');

export default function BookingRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = idParam.parse(params.id);
  const [moving, setMoving] = useState<BookingRow | null>(null);
  const closeMove = () => {
    setMoving(null);
  };
  const [leaving, setLeaving] = useState<BookingRow | null>(null);
  return (
    <>
      <BookingScreen
        id={id}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/guests');
        }}
        onChooseRoom={setMoving}
        onCheckOut={setLeaving}
      />
      {/* A completed move invalidates the desk queries, so the screen re-reads the booking. */}
      <ChooseRoomSheet booking={moving} onClose={closeMove} onMoved={closeMove} />
      {/* Its own sheet, never opened from inside another (iOS can't stack page sheets). */}
      <CheckOutSheet
        booking={leaving}
        onClose={() => {
          setLeaving(null);
        }}
      />
    </>
  );
}

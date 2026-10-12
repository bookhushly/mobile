import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { z } from 'zod';

import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { GuestsScreen } from '@/features/receptionist/screens/GuestsScreen';
import { CheckOutSheet } from '@/features/receptionist/ui/CheckOutSheet';
import { ChooseRoomSheet } from '@/features/receptionist/ui/ChooseRoomSheet';

const tabParam = z.enum(['arriving', 'inHouse', 'leaving']).catch('arriving');

export default function GuestsRoute() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = tabParam.parse(params.tab);
  // Tablet two-pane: the detail's Choose another room and Check out open here.
  const [moving, setMoving] = useState<BookingRow | null>(null);
  const closeMove = () => {
    setMoving(null);
  };
  const [leaving, setLeaving] = useState<BookingRow | null>(null);
  return (
    <>
      <GuestsScreen
        tab={tab}
        onTabChange={(next) => {
          router.setParams({ tab: next });
        }}
        onOpenBooking={(id) => {
          router.push({ pathname: '/booking/[id]', params: { id } });
        }}
        onChooseRoom={setMoving}
        onCheckOut={setLeaving}
      />
      <ChooseRoomSheet
        booking={moving}
        onClose={closeMove}
        onMoved={closeMove}
        onOpenRooms={() => {
          router.navigate({ pathname: '/rooms', params: { filter: 'dirty' } });
        }}
      />
      <CheckOutSheet
        booking={leaving}
        onClose={() => {
          setLeaving(null);
        }}
      />
    </>
  );
}

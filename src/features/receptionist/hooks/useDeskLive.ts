import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { deskKeys } from '@/features/receptionist/hooks/deskKeys';
import { trailing } from '@/shared/lib/trailing';
import { supabase } from '@/shared/supabase/client';

// A check-in touches a booking and a room within milliseconds: coalesce that burst, and under
// steady traffic invalidate at most once every LIVE_MAX_WAIT_MS.
const LIVE_SETTLE_MS = 500;
const LIVE_MAX_WAIT_MS = 2_000;
const LIVE_TABLES = ['hotel_bookings', 'hotel_rooms'] as const;

/**
 * R10: Realtime is only a "refetch now" trigger — payloads are never read as data. Missed events
 * (backgrounded, dropped socket) are covered by polling and the foreground refetch, and a
 * SUBSCRIBED (re)join refetches so the desk catches up. If events never arrive (publication
 * membership is unverified) this is harmless. Mounted once per hotel in the (receptionist) layout.
 */
export function useDeskLive(hotelId: string): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const bump = trailing(
      () => {
        void queryClient.invalidateQueries({ queryKey: deskKeys.all(hotelId) });
      },
      LIVE_SETTLE_MS,
      { maxWaitMs: LIVE_MAX_WAIT_MS },
    );
    let channel = supabase.channel(`desk:${hotelId}`);
    for (const table of LIVE_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `hotel_id=eq.${hotelId}` },
        () => {
          bump.call();
        },
      );
    }
    channel.subscribe((status) => {
      // Widened: the enum member is not comparable to its literal.
      const s: string = status;
      if (s === 'SUBSCRIBED') bump.call();
    });
    return () => {
      bump.cancel();
      void supabase.removeChannel(channel);
    };
  }, [hotelId, queryClient]);
}

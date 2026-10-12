import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { deskKeys } from '@/features/receptionist/hooks/deskKeys';
import { throttle } from '@/shared/lib/throttle';
import { supabase } from '@/shared/supabase/client';

// A busy hotel streams events: refetch at once on the first, then at most once per gap (one
// trailing run picks up the rest). Lists are capped at hundreds of rows, so this bounds the cost.
const LIVE_GAP_MS = 5_000;
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
    const bump = throttle(() => {
      // Backgrounded: the foreground refetch catches up, so don't spend a refetch now.
      if (AppState.currentState !== 'active') return;
      // A refetch already in flight (poll, action) is kept rather than cancelled and restarted.
      void queryClient.invalidateQueries(
        { queryKey: deskKeys.all(hotelId) },
        { cancelRefetch: false },
      );
    }, LIVE_GAP_MS);
    // A unique topic per run: `channel(topic)` returns a still-leaving channel of the same name, and
    // a quick remount would attach to it and then lose it with the old one.
    let channel = supabase.channel(`desk:${hotelId}:${String(Date.now())}`);
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

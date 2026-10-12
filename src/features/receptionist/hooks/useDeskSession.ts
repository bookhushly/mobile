import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useShiftLog } from '@/features/receptionist/state/shiftLog';

/**
 * R11 + privacy: the shift log is this desk session's. Leaving the desk (sign-out, mode switch:
 * the layout unmounts) empties it and drops every cached desk query (guest PII) from memory;
 * changing hotel empties it too, so one hotel's guest names never show at another.
 * `hotelId` is null while no hotel is in hand (that alone clears nothing).
 */
export function useDeskSession(hotelId: string | null): void {
  const queryClient = useQueryClient();
  useEffect(
    () => () => {
      useShiftLog.getState().clear();
      queryClient.removeQueries({ queryKey: ['desk'] });
    },
    [queryClient],
  );
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (hotelId === null) return;
    if (last.current !== null && last.current !== hotelId) useShiftLog.getState().clear();
    last.current = hotelId;
  }, [hotelId]);
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { DESK_POLL_MS, deskKeys, DeskLoadError } from '@/features/receptionist/hooks/deskKeys';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useFocusRefetch } from '@/features/receptionist/hooks/useFocusRefetch';
import type { RoomRow } from '@/features/receptionist/schemas/desk';

// `enabled: false` (a room picker not yet open) holds the query; `loading` stays true meanwhile.
export function useRooms({ enabled = true }: { enabled?: boolean } = {}): {
  rooms: RoomRow[];
  loading: boolean;
  error: boolean;
  /** Settles when the fetch ends, even on failure (pull-to-refresh spinners wait on it). */
  refetch: () => Promise<void>;
  updatedAt: number;
} {
  const { hotel } = useDesk();
  const isFocused = useIsFocused();
  const q = useQuery({
    queryKey: deskKeys.rooms(hotel.id),
    enabled,
    queryFn: async () => {
      const r = await deskDb.rooms(hotel.id);
      if (!r.ok) throw new DeskLoadError(r.error);
      return r.value;
    },
    refetchInterval: enabled && isFocused ? DESK_POLL_MS : false,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
  useFocusRefetch(enabled && isFocused, q);
  const { refetch } = q;
  return {
    rooms: q.data ?? [],
    loading: q.isPending,
    // Only when there is nothing to show; a failed background refetch keeps the rows (R10).
    error: q.isError && q.data === undefined,
    refetch: () => refetch().then(() => undefined),
    updatedAt: q.dataUpdatedAt,
  };
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { DESK_POLL_MS, deskKeys, DeskLoadError } from '@/features/receptionist/hooks/deskKeys';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import type { RoomRow } from '@/features/receptionist/schemas/desk';

export function useRooms(): {
  rooms: RoomRow[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
  updatedAt: number;
} {
  const { hotel } = useDesk();
  const isFocused = useIsFocused();
  const q = useQuery({
    queryKey: deskKeys.rooms(hotel.id),
    queryFn: async () => {
      const r = await deskDb.rooms(hotel.id);
      if (!r.ok) throw new DeskLoadError(r.error);
      return r.value;
    },
    refetchInterval: isFocused ? DESK_POLL_MS : false,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
  const { refetch } = q;
  return {
    rooms: q.data ?? [],
    loading: q.isPending,
    error: q.isError,
    refetch: () => void refetch(),
    updatedAt: q.dataUpdatedAt,
  };
}

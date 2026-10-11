import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { splitGuests, type GuestLists } from '@/features/receptionist/domain/guestLists';
import { DESK_POLL_MS, deskKeys, DeskLoadError } from '@/features/receptionist/hooks/deskKeys';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useFocusRefetch } from '@/features/receptionist/hooks/useFocusRefetch';
import type { BookingRow } from '@/features/receptionist/schemas/desk';

export function useGuests(): {
  lists: GuestLists | null;
  rows: BookingRow[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
  updatedAt: number;
} {
  const { hotel, today } = useDesk();
  const isFocused = useIsFocused();
  const q = useQuery({
    queryKey: deskKeys.guests(hotel.id, today),
    queryFn: async () => {
      const r = await deskDb.guests(hotel.id, today);
      if (!r.ok) throw new DeskLoadError(r.error);
      return r.value;
    },
    refetchInterval: isFocused ? DESK_POLL_MS : false,
    refetchOnWindowFocus: true,
    // A failed background refetch (or the day rolling over) keeps the list on screen.
    placeholderData: keepPreviousData,
  });
  useFocusRefetch(isFocused, q);
  const rows = q.data;
  const lists = useMemo(
    () => (rows === undefined ? null : splitGuests(rows, today)),
    [rows, today],
  );
  const { refetch } = q;
  return {
    lists,
    rows: rows ?? [],
    loading: q.isPending,
    // Only when there is nothing to show; a failed background refetch keeps the rows (R10).
    error: q.isError && q.data === undefined,
    refetch: () => void refetch(),
    updatedAt: q.dataUpdatedAt,
  };
}

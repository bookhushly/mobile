import { useQuery } from '@tanstack/react-query';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { deskKeys, DeskLoadError } from '@/features/receptionist/hooks/deskKeys';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import type { BookingRow } from '@/features/receptionist/schemas/desk';

// `booking` is undefined while loading and null when no such booking exists at this hotel.
// No polling: the detail refreshes on focus, on live events and after every action (R10).
export function useBooking(id: string): {
  booking: BookingRow | null | undefined;
  error: boolean;
  refetch: () => void;
} {
  const { hotel } = useDesk();
  const q = useQuery({
    queryKey: deskKeys.booking(hotel.id, id),
    queryFn: async () => {
      const r = await deskDb.bookingById(hotel.id, id);
      if (!r.ok) throw new DeskLoadError(r.error);
      return r.value;
    },
    refetchOnWindowFocus: true,
  });
  const { refetch } = q;
  return { booking: q.data, error: q.isError, refetch: () => void refetch() };
}

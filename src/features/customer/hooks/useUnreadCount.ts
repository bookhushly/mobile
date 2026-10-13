import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';

import { customerDb } from '@/features/customer/api/customerDb';
import { CustomerLoadError, customerKeys } from '@/features/customer/hooks/customerKeys';
import { useFocusRefetch } from '@/features/customer/hooks/useFocusRefetch';

/**
 * The Bookings bell (C13): a head count of unread notifications. Refetched when the screen regains
 * focus or the app returns to the foreground, never on an interval; the notifications screen
 * invalidates it after each write. A failed count shows no badge rather than a wrong one.
 */
export function useUnreadCount(userId: string): number {
  const isFocused = useIsFocused();
  const q = useQuery({
    queryKey: customerKeys.unreadCount(userId),
    queryFn: async () => {
      const r = await customerDb.unreadCount(userId);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    refetchOnWindowFocus: true,
  });
  useFocusRefetch(isFocused, q);
  return q.data ?? 0;
}

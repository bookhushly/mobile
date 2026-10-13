import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Privacy: leaving customer mode (sign-out, mode switch: the layout unmounts) drops every cached
 * customer query (bookings, tickets, notifications, profile) from memory. Mirrors the desk's
 * `useDeskSession`. The offline wallet on disk is the sign-out guard's job, not this one's.
 */
export function useCustomerSession(): void {
  const queryClient = useQueryClient();
  useEffect(
    () => () => {
      queryClient.removeQueries({ queryKey: ['customer'] });
    },
    [queryClient],
  );
}

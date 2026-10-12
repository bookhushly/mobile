import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { DeskProvider, type Desk } from '@/features/receptionist/hooks/DeskContext';
import type { BookingRow } from '@/features/receptionist/schemas/desk';

export const HOTEL = 'h1';
export const TODAY = '2026-10-11';

export const desk: Desk = {
  userId: 'u1',
  email: 'desk@example.com',
  hotel: { id: HOTEL, name: 'Eko Suites', place: 'Ikeja, Lagos' },
  today: TODAY,
  openAccount: () => undefined,
  openCheckIn: () => undefined,
  signOut: () => undefined,
};

// gcTime Infinity: no 5-minute GC timer after unmount to keep the Jest worker alive.
export function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

export function deskWrapper(qc: QueryClient, over: Partial<Desk> = {}) {
  const value = { ...desk, ...over };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <DeskProvider value={value}>{children}</DeskProvider>
      </QueryClientProvider>
    );
  };
}

export function booking(id: string, over: Partial<BookingRow> = {}): BookingRow {
  return {
    id,
    guest_name: `Guest ${id}`,
    guest_phone: null,
    check_in_date: TODAY,
    check_out_date: '2026-10-13',
    adults: 1,
    children: 0,
    booking_status: 'confirmed',
    payment_status: 'completed',
    checked_in: false,
    checked_in_at: null,
    checked_out_at: null,
    check_in_code: null,
    special_requests: null,
    hotel_rooms: null,
    ...over,
  };
}

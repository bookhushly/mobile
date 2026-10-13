import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import type { NotificationRow } from '@/features/customer/schemas/notifications';

export const USER = 'u1';
export const TODAY = '2026-10-13';
/** 12:00 Lagos on TODAY. */
export const NOON = Date.parse(`${TODAY}T11:00:00Z`);

// gcTime Infinity: no 5-minute GC timer after unmount to keep the Jest worker alive.
export function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

export function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

export function ev(p: Partial<EventBookingRow> = {}): EventBookingRow {
  return {
    id: 'e1',
    status: 'confirmed',
    payment_status: 'completed',
    total_amount: 45000,
    booking_date: '2026-10-01',
    booking_time: '10:00:00',
    guests: 1,
    ticket_details: null,
    seat_assignments: null,
    created_at: '2026-10-01T10:00:00+00:00',
    listing: {
      id: 'l1',
      title: 'Afrobeats night',
      location: 'Eko Hotel, Lagos',
      media_urls: [],
      event_date: '2026-10-20T00:00:00',
      event_time: '2026-10-20T18:00:00+00:00',
      event_end_date: null,
      require_dynamic_ticket: true,
    },
    tickets: [{ id: 't1', ticket_type: 'Regular', ticket_index: 1, checked_in_at: null }],
    ...p,
  };
}

export function ho(p: Partial<HotelBookingRow> = {}): HotelBookingRow {
  return {
    id: 'h1',
    check_in_date: TODAY,
    check_out_date: '2026-10-15',
    adults: 2,
    children: 0,
    payment_status: 'completed',
    total_amount: 45000,
    booking_status: 'confirmed',
    checked_in: false,
    checked_in_at: null,
    checked_out_at: null,
    check_in_code: 'AB12CD34',
    created_at: '2026-10-01T10:00:00+00:00',
    hotel: {
      id: 'ho1',
      name: 'Harbour Suites',
      city: 'Ikeja',
      state: 'Lagos',
      address: null,
      image_urls: [],
      check_in_time: '14:00:00',
      check_out_time: '12:00:00',
    },
    room_type: { id: 'rt1', name: 'Deluxe' },
    ...p,
  };
}

export function ap(p: Partial<ApartmentBookingRow> = {}): ApartmentBookingRow {
  return {
    id: 'a1',
    check_in_date: '2026-10-01',
    check_out_date: '2026-10-03',
    number_of_nights: 2,
    number_of_guests: 2,
    payment_status: 'paid',
    total_amount: 45000,
    booking_status: 'checked_out',
    checked_in_at: null,
    checked_out_at: null,
    created_at: '2026-09-20T10:00:00+00:00',
    apartment: null,
    ...p,
  };
}

export function note(id: string, p: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id,
    type: 'booking_confirmed',
    title: `Title ${id}`,
    message: 'Message',
    data: null,
    link: null,
    read: false,
    created_at: `2026-10-1${String(9 - id.length)}T10:00:00+00:00`,
    ...p,
  };
}

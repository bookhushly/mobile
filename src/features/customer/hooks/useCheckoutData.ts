import { useQuery } from '@tanstack/react-query';

import { roomAvailability, serviceCharge } from '@/features/customer/api/checkoutApi';
import { checkoutDb } from '@/features/customer/api/checkoutDb';
import { checkoutKeys, CustomerLoadError } from '@/features/customer/hooks/customerKeys';
import { api } from '@/shared/api/instance';

// Reads the checkout form needs before create. A failed read is an error, never an empty list:
// skipping required questions or extras would send a booking the server refuses (checkoutDb).

const AVAILABILITY_STALE_MS = 15_000;

export function useEventQuestions(listingId: string | null) {
  return useQuery({
    queryKey: checkoutKeys.questions(listingId ?? ''),
    queryFn: () => checkoutDb.eventQuestions(listingId ?? ''),
    enabled: listingId !== null,
  });
}

export function useHotelExtras(hotelId: string | null) {
  return useQuery({
    queryKey: checkoutKeys.hotelExtras(hotelId ?? ''),
    queryFn: () => checkoutDb.hotelExtras(hotelId ?? ''),
    enabled: hotelId !== null,
  });
}

export function useApartmentExtras(apartmentId: string | null) {
  return useQuery({
    queryKey: checkoutKeys.apartmentExtras(apartmentId ?? ''),
    queryFn: () => checkoutDb.apartmentExtras(apartmentId ?? ''),
    enabled: apartmentId !== null,
  });
}

/** Free rooms for a date pair; off until both dates are chosen. Advisory: create decides. */
export function useRoomAvailability(
  roomTypeId: string | null,
  checkIn: string | null,
  checkOut: string | null,
) {
  return useQuery({
    queryKey: checkoutKeys.availability(roomTypeId ?? '', checkIn ?? '', checkOut ?? ''),
    queryFn: async () => {
      const r = await roomAvailability(api, roomTypeId ?? '', checkIn ?? '', checkOut ?? '');
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    enabled: roomTypeId !== null && checkIn !== null && checkOut !== null,
    staleTime: AVAILABILITY_STALE_MS,
  });
}

/** The service charge estimate shown on Review; initialise computes the real one. */
export function useServiceCharge(type: 'hotel' | 'apartment' | 'event') {
  return useQuery({
    queryKey: checkoutKeys.serviceCharge(type),
    queryFn: async () => {
      const r = await serviceCharge(api, type);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value.charge;
    },
  });
}

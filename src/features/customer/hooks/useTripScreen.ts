import { useState } from 'react';

import {
  stateOfDestination,
  type Trip,
  type TripService,
  type TripServiceType,
} from '@/features/customer/domain/trips/trips';
import { CustomerLoadError } from '@/features/customer/hooks/customerKeys';
import {
  useAddTripService,
  useTrip,
  useTripLink,
  useTripStatus,
  useTrips,
} from '@/features/customer/hooks/useTrips';
import type { TripProblem } from '@/features/customer/screens/TripScreen';

export type TripBooking =
  | { to: 'results'; category: 'hotels' | 'serviced_apartments' | 'events'; region?: string }
  | { to: 'car-rental' | 'logistics' | 'security' };

/** Where a trip's planned service is booked, with the trip chosen for it at checkout. */
export function bookingFor(trip: Trip, s: TripService): TripBooking {
  return bookingForType(s.type, trip.destination);
}

/** Where a kind of booking starts: listings (in the trip's state, if any) or a request flow. */
export function bookingForType(
  type: TripServiceType,
  destination: string | null = null,
): TripBooking {
  const region = destination === null ? {} : { region: stateOfDestination(destination) };
  switch (type) {
    case 'hotel':
      return { to: 'results', category: 'hotels', ...region };
    case 'apartment':
      return { to: 'results', category: 'serviced_apartments', ...region };
    case 'event':
      return { to: 'results', category: 'events', ...region };
    case 'car_rental':
      return { to: 'car-rental' };
    case 'logistics':
      return { to: 'logistics' };
    case 'security':
      return { to: 'security' };
  }
}

const words = (e: unknown): TripProblem =>
  e instanceof CustomerLoadError && e.kind === 'auth'
    ? {
        title: 'Sign in again',
        message: 'Your session has ended. Sign in again to change this trip.',
      }
    : {
        title: 'That didn’t save',
        message: 'Nothing changed. Check your connection and try again.',
      };

/** The trip screen's state and actions. */
export function useTripScreen(userId: string, id: string) {
  const q = useTrip(userId, id);
  const list = useTrips(userId);
  const add = useAddTripService(userId);
  const status = useTripStatus(userId);
  const choose = useTripLink((s) => s.choose);
  const [refreshing, setRefreshing] = useState(false);
  const failed = add.error ?? status.error;
  return {
    q,
    refreshing,
    refresh: () => {
      setRefreshing(true);
      void Promise.all([q.refetch(), list.refetch()]).finally(() => {
        setRefreshing(false);
      });
    },
    busy: add.isPending || status.isPending,
    problem: failed === null ? null : words(failed),
    /** Chooses this trip for the next booking of that kind, then says where to go. */
    book: (trip: Trip, s: TripService): TripBooking => {
      choose(s.type, s.id);
      return bookingFor(trip, s);
    },
    add: async (trip: Trip, type: TripService['type']) => {
      // One at a time (the write also re-reads the trip's services, so a repeat adds nothing).
      if (add.isPending) return false;
      status.reset();
      try {
        await add.mutateAsync({ trip, type });
        return true;
      } catch {
        return false;
      }
    },
    setStatus: async (tripId: string, to: 'completed' | 'cancelled') => {
      add.reset();
      try {
        await status.mutateAsync({ id: tripId, status: to });
        return true;
      } catch {
        return false;
      }
    },
  };
}

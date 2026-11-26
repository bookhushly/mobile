import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { tripsDb } from '@/features/customer/api/tripsDb';
import {
  linkTargets,
  type LinkTarget,
  type Trip,
  type TripDraft,
  type TripServiceType,
} from '@/features/customer/domain/trips/trips';
import { CustomerLoadError, customerKeys } from '@/features/customer/hooks/customerKeys';
import { queryClient } from '@/shared/api/queryClient';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';
import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';

async function unwrap<T>(p: Promise<Result<T, ApiError>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new CustomerLoadError(r.error);
  return r.value;
}

/** The customer's open trips; nothing is asked signed out. */
export function useTrips(userId: string) {
  return useQuery({
    queryKey: customerKeys.trips(userId),
    queryFn: () => unwrap(tripsDb.list(userId)),
    enabled: userId !== '',
  });
}

export function useTrip(userId: string, id: string) {
  return useQuery({
    queryKey: customerKeys.trip(userId, id),
    queryFn: () => unwrap(tripsDb.get(userId, id)),
    enabled: userId !== '' && id !== '',
  });
}

/** Every trip read, after any change to one (the list shows each trip's services). */
function useRefreshTrips(userId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: customerKeys.trips(userId) });
}

export function useCreateTrip(userId: string) {
  const refresh = useRefreshTrips(userId);
  return useMutation({
    mutationFn: (v: { tripId: string; draft: TripDraft }) =>
      unwrap(tripsDb.create(userId, v.tripId, v.draft)),
    onSettled: refresh,
  });
}

export function useAddTripService(userId: string) {
  const refresh = useRefreshTrips(userId);
  return useMutation({
    mutationFn: (v: { trip: Trip; type: TripServiceType }) =>
      unwrap(tripsDb.addService(v.trip, v.type)),
    onSettled: refresh,
  });
}

export function useTripStatus(userId: string) {
  const refresh = useRefreshTrips(userId);
  return useMutation({
    mutationFn: (v: { id: string; status: 'completed' | 'cancelled' }) =>
      unwrap(tripsDb.setStatus(userId, v.id, v.status)),
    onSettled: refresh,
  });
}

/** Trips a new booking of `type` could join (none while loading, failed or signed out). */
export function useLinkTargets(userId: string, type: TripServiceType): LinkTarget[] {
  const q = useTrips(userId);
  return q.data === undefined ? [] : linkTargets(q.data, type);
}

type LinkStore = {
  /** The trip service a new booking of each kind is for; null = not part of a trip. */
  chosen: Partial<Record<TripServiceType, string | null>>;
  choose: (type: TripServiceType, tripServiceId: string | null) => void;
};

/**
 * Which trip the booking being made belongs to: set by "Browse hotels" on a trip, or by the
 * "Part of a trip" choice at checkout, read when the booking is sent. In memory only.
 */
export const useTripLink = create<LinkStore>((set) => ({
  chosen: {},
  choose(type, tripServiceId) {
    set((s) => ({ chosen: { ...s.chosen, [type]: tripServiceId } }));
  },
}));
registerAlwaysWipe(() => {
  useTripLink.setState({ chosen: {} });
  return Promise.resolve();
});

/**
 * The link to send with a new booking of `type`: the chosen trip service, only while it's still
 * one the customer is shown (an open trip, the service still planned, the trips loaded). The
 * server checks it again (own trip, same kind, still planned).
 */
export function tripServiceIdFor(userId: string, type: TripServiceType): string | null {
  const id = useTripLink.getState().chosen[type] ?? null;
  if (id === null || userId === '') return null;
  const trips = queryClient.getQueryData<Trip[]>(customerKeys.trips(userId));
  if (trips === undefined) return null;
  return linkTargets(trips, type).some((t) => t.tripServiceId === id) ? id : null;
}

/** After a booking, request or payment: trips show what's booked, and stop offering it. */
export function refreshTrips(userId: string): void {
  if (userId === '') return;
  void queryClient.invalidateQueries({ queryKey: customerKeys.trips(userId) });
}

/** After a booking of `type` is created: the next one starts unlinked. */
export function clearTripLink(type: TripServiceType): void {
  useTripLink.getState().choose(type, null);
}

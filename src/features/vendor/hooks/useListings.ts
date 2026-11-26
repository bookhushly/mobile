import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { vendorSource } from '@/features/vendor/api/vendorSource';
import type { StayStatus } from '@/features/vendor/domain/listings';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import { vendorKeys } from '@/features/vendor/hooks/useVendor';
import { VendorError } from '@/features/vendor/hooks/useVendorRequests';
import { otherRefusal, vendorRetry } from '@/features/vendor/hooks/vendorErrors';
import { clock } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';
import type { IsoDate } from '@/shared/lib/lagosDay';
import type { Result } from '@/shared/lib/result';

type Who = { vendorId: string; kind: ServedKind };

async function unwrap<T>(p: Promise<Result<T, ApiError>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new VendorError(r.error);
  return r.value;
}

export function useBookings({ vendorId, kind }: Who) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.bookings(vendorId),
    queryFn: () => unwrap(vendorSource.bookings(kind, clock.serverNow())),
  });
}

export function useBooking({ vendorId, kind }: Who, id: string) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.booking(vendorId, id),
    queryFn: () => unwrap(vendorSource.booking(kind, id, clock.serverNow())),
  });
}

/** Confirm, decline, check in or out an apartment stay. A stale status comes back as a 409. */
export function useMoveBooking({ vendorId, kind }: Who, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: { from: StayStatus; to: StayStatus }) =>
      unwrap(vendorSource.moveBooking(kind, id, m.from, m.to, clock.serverNow())),
    onSuccess: (b) => {
      qc.setQueryData(vendorKeys.booking(vendorId, id), b);
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: vendorKeys.bookings(vendorId) }),
        qc.invalidateQueries({ queryKey: vendorKeys.calendar(vendorId) }),
      ]),
  });
}

/** Move any booking (Today's quick Confirm), by id. */
export function useMoveAnyBooking({ vendorId, kind }: Who) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: { id: string; from: StayStatus; to: StayStatus }) =>
      unwrap(vendorSource.moveBooking(kind, m.id, m.from, m.to, clock.serverNow())),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: vendorKeys.bookings(vendorId) }),
        qc.invalidateQueries({ queryKey: vendorKeys.calendar(vendorId) }),
      ]),
  });
}

export function useCalendar({ vendorId }: Who) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.calendar(vendorId),
    queryFn: () => unwrap(vendorSource.calendar(clock.serverNow())),
  });
}

export function useToggleBlocked({ vendorId }: Who) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: IsoDate) => unwrap(vendorSource.toggleBlocked(date, clock.serverNow())),
    onSettled: () => qc.invalidateQueries({ queryKey: vendorKeys.calendar(vendorId) }),
  });
}

export function useEvents({ vendorId }: Who) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.events(vendorId),
    queryFn: () => unwrap(vendorSource.events(clock.serverNow())),
  });
}

export type StayProblem = { title: string; message: string; transient: boolean };

export function stayErrorWords(e: unknown): StayProblem {
  const a = e instanceof VendorError ? e.apiError : null;
  if (a?.kind === 'conflict' && a.code === 'date_booked')
    return {
      title: 'That date is booked',
      message: 'A guest has it. Only free dates can be blocked.',
      transient: false,
    };
  if (a?.kind === 'forbidden')
    return {
      title: 'Your account can’t manage bookings right now',
      message: 'Open bookhushly.com to see why, or contact Bookhushly support.',
      transient: false,
    };
  if (a?.kind === 'conflict')
    return {
      title: 'This booking has changed',
      message: 'Someone else updated it first. We’ve refreshed it so you can see where it stands.',
      transient: false,
    };
  const other = otherRefusal(a);
  if (other !== null) return other;
  return {
    title: 'We couldn’t reach Bookhushly',
    message: 'We couldn’t confirm it went through. Check your connection and try again.',
    transient: true,
  };
}

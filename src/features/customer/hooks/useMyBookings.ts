import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';

import { customerDb } from '@/features/customer/api/customerDb';
import { showCheckInCode } from '@/features/customer/domain/checkInCode';
import {
  fromApartment,
  fromEvent,
  fromHotel,
  splitBookings,
  type MyBooking,
  type When,
} from '@/features/customer/domain/myBookings';
import { canShowTickets, liveOnly, ticketsOf } from '@/features/customer/domain/tickets';
import { CustomerLoadError, customerKeys } from '@/features/customer/hooks/customerKeys';
import { useFocusRefetch } from '@/features/customer/hooks/useFocusRefetch';
import { useSavedWallet } from '@/features/customer/hooks/useSavedWallet';
import { wallet, type WalletEntry } from '@/features/customer/offline/wallet';
import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import { clock } from '@/shared/api/instance';
import { daysBetween, lagosToday, type IsoDate } from '@/shared/lib/lagosDay';

export type BookingRows = {
  events: EventBookingRow[];
  hotels: HotelBookingRow[];
  apartments: ApartmentBookingRow[];
};
export type BookingLists = { today: MyBooking[]; upcoming: MyBooking[]; past: MyBooking[] };

export function mapBookings(rows: BookingRows, today: IsoDate): MyBooking[] {
  return [
    ...rows.events.map((r) => fromEvent(r, today)),
    ...rows.hotels.map((r) => fromHotel(r, today)),
    ...rows.apartments.map((r) => fromApartment(r, today)),
  ];
}

// C9: what the wallet may keep. Tickets only when they may be shown (C6), the check-in code only
// when the web rule shows it (C10).
export function walletEntries(rows: BookingRows, today: IsoDate): WalletEntry[] {
  return [
    ...rows.events.map((r): WalletEntry => {
      const b = fromEvent(r, today);
      return canShowTickets(r) === 'show'
        ? { ...b, tickets: ticketsOf(r), liveOnly: liveOnly(r) }
        : { ...b, liveOnly: liveOnly(r) };
    }),
    ...rows.hotels.map((r): WalletEntry => {
      const b = fromHotel(r, today);
      return showCheckInCode(r) ? { ...b, checkInCode: r.check_in_code } : b;
    }),
    ...rows.apartments.map((r) => fromApartment(r, today)),
  ];
}

// Saved entries carry the `when` of the day they were saved; re-derive it for today. Gone ones
// (and anything the wallet still holds from before) never show: the wallet is today + upcoming.
export function walletLists(entries: readonly WalletEntry[], today: IsoDate): BookingLists {
  const live: WalletEntry[] = [];
  for (const e of entries) {
    if (e.when === 'past' || daysBetween(today, e.end) < 0) continue;
    // An early arrival saved as "today" (checked in before the date) stays today.
    const when: When =
      e.when === 'today' || daysBetween(today, e.start) <= 0 ? 'today' : 'upcoming';
    live.push({ ...e, when });
  }
  const { today: t, upcoming } = splitBookings(live);
  return { today: t, upcoming, past: [] };
}

// Lagos today, re-read whenever a fetch settles (focus, foreground, pull). Held in state rather
// than read in render: the React Compiler may cache a render-time read that has no inputs.
function useTodayAt(stamp: string): IsoDate {
  const [held, setHeld] = useState(() => ({ stamp, today: lagosToday(clock.serverNow()) }));
  if (held.stamp !== stamp) {
    const next = { stamp, today: lagosToday(clock.serverNow()) };
    setHeld(next);
    return next.today;
  }
  return held.today;
}

async function loadAll(userId: string): Promise<BookingRows> {
  const [events, hotels, apartments] = await Promise.all([
    customerDb.events(userId),
    customerDb.hotels(userId),
    customerDb.apartments(userId),
  ]);
  // Any failed table fails the load: a partial list would read as "you have no hotel bookings".
  if (!events.ok) throw new CustomerLoadError(events.error);
  if (!hotels.ok) throw new CustomerLoadError(hotels.error);
  if (!apartments.ok) throw new CustomerLoadError(apartments.error);
  const rows = { events: events.value, hotels: hotels.value, apartments: apartments.value };
  const now = clock.serverNow();
  // Fire-and-forget: a wallet that can't be written only costs the offline copy.
  wallet.save(userId, walletEntries(rows, lagosToday(now)), now).catch(() => undefined);
  return rows;
}

export function useMyBookings(userId: string): {
  bookings: BookingLists | null;
  rows: BookingRows | null;
  /** Showing wallet data because the network load failed. */
  saved: { savedAt: number } | null;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<unknown>;
} {
  const isFocused = useIsFocused();
  // C17: on focus, on foreground (TanStack's focusManager) and on pull; no interval.
  const q = useQuery({
    queryKey: customerKeys.bookings(userId),
    queryFn: () => loadAll(userId),
    refetchOnWindowFocus: true,
  });
  useFocusRefetch(isFocused, q);
  const failed = q.isError && q.data === undefined;
  const w = useSavedWallet(userId, failed);

  const rows = q.data;
  // Every fetch flips fetchStatus, even one that settles within the same millisecond.
  const today = useTodayAt(
    `${String(q.dataUpdatedAt)}|${String(q.errorUpdatedAt)}|${q.fetchStatus}`,
  );
  const fresh = useMemo(
    () => (rows === undefined ? null : splitBookings(mapBookings(rows, today))),
    [rows, today],
  );
  const saved = w.wallet ?? null;
  const fromWallet = useMemo(
    () => (saved === null ? null : walletLists(saved.entries, today)),
    [saved, today],
  );

  return {
    bookings: fresh ?? fromWallet,
    rows: rows ?? null,
    saved: saved === null ? null : { savedAt: saved.savedAt },
    loading: q.isPending || (failed && w.wallet === undefined),
    error: failed && w.wallet === null,
    refetch: q.refetch,
  };
}

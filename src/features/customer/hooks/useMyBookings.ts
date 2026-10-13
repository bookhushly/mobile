import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';

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
import {
  fetchStamp,
  loadFailed,
  useSavedWallet,
  useTodayAt,
} from '@/features/customer/hooks/useSavedWallet';
import { wallet, type WalletEntry } from '@/features/customer/offline/wallet';
import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import { clock } from '@/shared/api/instance';
import { daysBetween, lagosToday, type IsoDate } from '@/shared/lib/lagosDay';
import { supabase } from '@/shared/supabase/client';

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

// A saved entry carries the `when` of the day it was saved; re-derive it for today. An ended one
// (or a past one) is null: the wallet only vouches for today and upcoming.
export function walletEntryToday(e: WalletEntry, today: IsoDate): WalletEntry | null {
  if (e.when === 'past' || daysBetween(today, e.end) < 0) return null;
  // An early arrival saved as "today" (checked in before the date) stays today.
  const when: When = e.when === 'today' || daysBetween(today, e.start) <= 0 ? 'today' : 'upcoming';
  return { ...e, when };
}

export function walletLists(entries: readonly WalletEntry[], today: IsoDate): BookingLists {
  const live: WalletEntry[] = [];
  for (const e of entries) {
    const d = walletEntryToday(e, today);
    if (d !== null) live.push(d);
  }
  const { today: t, upcoming } = splitBookings(live);
  return { today: t, upcoming, past: [] };
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
  // Fire-and-forget: a wallet that can't be written only costs the offline copy.
  void saveWallet(userId, rows);
  return rows;
}

// Only for the account still signed in: a load that lands after sign-out (and its wipe) must
// not write this account's bookings back to disk.
async function saveWallet(userId: string, rows: BookingRows): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== userId) return;
    const now = clock.serverNow();
    await wallet.save(userId, walletEntries(rows, lagosToday(now)), now);
  } catch {
    // see above
  }
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
  const failed = loadFailed(q);
  const w = useSavedWallet(userId, failed);

  const rows = q.data;
  const today = useTodayAt(fetchStamp(q));
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
    loading: failed ? w.wallet === undefined : q.isPending,
    error: failed && w.wallet === null,
    refetch: q.refetch,
  };
}

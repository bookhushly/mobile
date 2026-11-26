import { BedDouble, ScanLine } from 'lucide-react-native';
import { useState } from 'react';

import type { BookingTab, ListingBooking } from '@/features/vendor/domain/listings';
import { addMonths } from '@/features/vendor/domain/calendarMonth';
import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import {
  stayErrorWords,
  useBooking,
  useBookings,
  useCalendar,
  useEvents,
  useMoveAnyBooking,
  useMoveBooking,
  useToggleBlocked,
} from '@/features/vendor/hooks/useListings';
import { VendorError } from '@/features/vendor/hooks/useVendorRequests';
import { ApartmentTodayScreen } from '@/features/vendor/screens/ApartmentTodayScreen';
import { BookingScreen } from '@/features/vendor/screens/BookingScreen';
import { BookingsScreen } from '@/features/vendor/screens/BookingsScreen';
import { CalendarScreen } from '@/features/vendor/screens/CalendarScreen';
import { EventTodayScreen } from '@/features/vendor/screens/EventTodayScreen';
import { EventsScreen } from '@/features/vendor/screens/EventsScreen';
import { HandOffScreen } from '@/features/vendor/screens/HandOffScreen';
import { HotelTodayScreen } from '@/features/vendor/screens/HotelTodayScreen';
import { KIND_WORD } from '@/features/vendor/ui/kindWords';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';

// Containers for hotels, apartments and events. Navigation comes in from the routes.

function useWho() {
  const { vendor } = useVendorSession();
  return { vendorId: vendor.id, kind: vendor.kind };
}

/** A query as the screens' load state, with pull-to-refresh. */
function useLoad<T>(q: {
  isPending: boolean;
  isError: boolean;
  data: T | undefined;
  refetch: () => Promise<unknown>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  if (q.isPending || q.data === undefined)
    return q.isError
      ? ({ status: 'error', retry: () => void q.refetch() } as const)
      : ({ status: 'loading' } as const);
  return {
    status: 'ready' as const,
    data: q.data,
    refreshing,
    refresh: () => {
      setRefreshing(true);
      void q.refetch().finally(() => {
        setRefreshing(false);
      });
    },
  };
}

function useTop() {
  const { vendor } = useVendorSession();
  const nowMs = clock.serverNow();
  return {
    businessName: vendor.name,
    kindWord: KIND_WORD[vendor.kind],
    today: lagosToday(nowMs),
    nowMs,
  };
}

type TodayNav = {
  onOpenBookings: () => void;
  onOpenBooking: (id: string) => void;
  onOpenEvents: () => void;
};

export function HotelToday({ onOpenBookings, onOpenBooking }: TodayNav) {
  const { switchToDesk } = useVendorSession();
  const state = useLoad(useBookings(useWho()));
  return (
    <HotelTodayScreen
      top={useTop()}
      state={state}
      onCheckIn={switchToDesk}
      onOpenBookings={onOpenBookings}
      onOpenBooking={(b) => {
        onOpenBooking(b.id);
      }}
    />
  );
}

export function ApartmentToday({ onOpenBookings, onOpenBooking }: TodayNav) {
  const who = useWho();
  const state = useLoad(useBookings(who));
  const move = useMoveAnyBooking(who);
  return (
    <ApartmentTodayScreen
      top={useTop()}
      state={state}
      busyId={move.isPending ? move.variables.id : null}
      problem={move.isError ? stayErrorWords(move.error) : null}
      onAnswer={(b, confirm) => {
        if (move.isPending) return;
        // Confirming is one tap; declining asks first, on the booking itself.
        if (confirm) move.mutate({ id: b.id, from: b.status, to: 'confirmed' });
        else onOpenBooking(b.id);
      }}
      onOpenBookings={onOpenBookings}
    />
  );
}

export function EventToday({ onOpenEvents }: TodayNav) {
  const { switchToGate } = useVendorSession();
  const state = useLoad(useEvents(useWho()));
  return (
    <EventTodayScreen
      top={useTop()}
      state={state}
      onScan={switchToGate}
      onOpenEvents={onOpenEvents}
    />
  );
}

export function VendorBookings({ onOpen }: { onOpen: (b: ListingBooking) => void }) {
  const { vendor } = useVendorSession();
  const kind = vendor.kind === 'hotel' ? 'hotel' : 'apartment';
  const load = useLoad(useBookings(useWho()));
  const [tab, setTab] = useState<BookingTab>(kind === 'apartment' ? 'toConfirm' : 'upcoming');
  return (
    <BookingsScreen
      kind={kind}
      today={lagosToday(clock.serverNow())}
      tab={tab}
      onTab={setTab}
      onOpen={onOpen}
      state={load.status === 'ready' ? { ...load, bookings: load.data } : load}
    />
  );
}

export function VendorBooking({ id, onBack }: { id: string; onBack: () => void }) {
  const { switchToDesk } = useVendorSession();
  const who = useWho();
  const q = useBooking(who, id);
  const move = useMoveBooking(who, id);
  return (
    <BookingScreen
      busy={move.isPending}
      problem={move.isError ? stayErrorWords(move.error) : null}
      onBack={onBack}
      onFrontDesk={switchToDesk}
      onMove={(from, to) => {
        if (move.isPending) return;
        move.mutate({ from, to });
      }}
      state={
        q.isPending
          ? { status: 'loading' }
          : q.isError
            ? {
                status: 'error',
                notFound: q.error instanceof VendorError && q.error.kind === 'notFound',
                retry: () => void q.refetch(),
              }
            : { status: 'ready', booking: q.data }
      }
    />
  );
}

export function VendorCalendar() {
  const who = useWho();
  const q = useCalendar(who);
  const toggle = useToggleBlocked(who);
  const today = lagosToday(clock.serverNow());
  const [month, setMonth] = useState(addMonths(today, 0));
  return (
    <CalendarScreen
      today={today}
      month={month}
      onMonth={setMonth}
      busyDate={toggle.isPending ? toggle.variables : null}
      problem={toggle.isError ? stayErrorWords(toggle.error) : null}
      onToggle={(d) => {
        if (!toggle.isPending) toggle.mutate(d);
      }}
      state={
        q.isPending
          ? { status: 'loading' }
          : q.isError
            ? { status: 'error', retry: () => void q.refetch() }
            : { status: 'ready', booked: q.data.booked, blocked: q.data.blocked }
      }
    />
  );
}

export function VendorEvents() {
  const { openWeb } = useVendorSession();
  const load = useLoad(useEvents(useWho()));
  return (
    <EventsScreen
      nowMs={clock.serverNow()}
      onManage={() => {
        openWeb('/vendor/dashboard/event-management');
      }}
      state={load.status === 'ready' ? { ...load, events: load.data } : load}
    />
  );
}

export function VendorScan() {
  const { switchToGate } = useVendorSession();
  return (
    <HandOffScreen
      icon={ScanLine}
      title="Scan tickets"
      message={
        switchToGate === null
          ? 'Scanning opens once you have an event coming up. Your gate staff can scan from their own Bookhushly app.'
          : 'Scanning opens the gate screens: they work offline at the door and check each ticket once.'
      }
      action={switchToGate === null ? null : { label: 'Open the scanner', onPress: switchToGate }}
      testID="vendor-open-scanner"
    />
  );
}

export function VendorRooms() {
  const { switchToDesk } = useVendorSession();
  return (
    <HandOffScreen
      icon={BedDouble}
      title="Rooms"
      message={
        switchToDesk === null
          ? 'Room status and check-in are on the front desk. Your front-desk staff use it from their Bookhushly app.'
          : 'Room status and check-in are on the front desk.'
      }
      action={
        switchToDesk === null ? null : { label: 'Open the front desk', onPress: switchToDesk }
      }
    />
  );
}

import { useState } from 'react';

import { addMonths } from '@/features/vendor/domain/calendarMonth';
import {
  calendarErrorWords,
  useApartments,
  useCalendar,
  useToggleBlocked,
} from '@/features/vendor/hooks/useListings';
import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { useWho } from '@/features/vendor/hooks/useVendorScreen';
import { CalendarScreen } from '@/features/vendor/screens/CalendarScreen';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';

export function VendorCalendar() {
  const who = useWho();
  const { openWeb } = useVendorSession();
  const apartments = useApartments(who);
  const today = lagosToday(clock.serverNow());
  const [month, setMonth] = useState(addMonths(today, 0));
  const [picked, setPicked] = useState<string | null>(null);
  const list = apartments.data ?? [];
  // The one the vendor picked while it's still theirs, else the first (live ones come first).
  const selected = list.find((a) => a.id === picked)?.id ?? list[0]?.id ?? null;
  const q = useCalendar(who, selected, month);
  const toggle = useToggleBlocked(who);
  // A save still running for another apartment isn't shown on this one.
  const mine = toggle.variables?.apartmentId === selected;
  return (
    <CalendarScreen
      apartments={
        // A failed background refresh keeps what's already on screen.
        apartments.data !== undefined
          ? { status: 'ready', list, selected }
          : apartments.isError
            ? { status: 'error', retry: () => void apartments.refetch() }
            : { status: 'loading' }
      }
      onApartment={(id) => {
        if (!toggle.isPending) toggle.reset();
        setPicked(id);
      }}
      onOpenWeb={() => {
        openWeb();
      }}
      today={today}
      month={month}
      onMonth={setMonth}
      busyDate={toggle.isPending && mine ? toggle.variables.date : null}
      problem={toggle.isError && mine ? calendarErrorWords(toggle.error) : null}
      onToggle={(d) => {
        if (!toggle.isPending && selected !== null)
          toggle.mutate({ apartmentId: selected, date: d });
      }}
      state={
        q.data !== undefined
          ? { status: 'ready', booked: q.data.booked, blocked: q.data.blocked }
          : q.isError
            ? { status: 'error', retry: () => void q.refetch() }
            : { status: 'loading' }
      }
    />
  );
}

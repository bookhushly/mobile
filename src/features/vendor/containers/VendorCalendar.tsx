import { useState } from 'react';

import { addMonths } from '@/features/vendor/domain/calendarMonth';

import { stayErrorWords, useCalendar, useToggleBlocked } from '@/features/vendor/hooks/useListings';

import { CalendarScreen } from '@/features/vendor/screens/CalendarScreen';

import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { useWho } from '@/features/vendor/hooks/useVendorScreen';

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

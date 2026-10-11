import type { Blocker, Warning } from '@/features/receptionist/domain/bookingState';
import { lagosTime, shortDate } from '@/shared/lib/lagosDay';
import type { StatusTone } from '@/shared/theme';

const days = (n: number) => `${String(n)} ${n === 1 ? 'day' : 'days'}`;

// R15: warnings are information before confirming, never blocking.
export function warningText(w: Warning): string {
  switch (w.kind) {
    case 'earlyArrival':
      return `Booked for ${shortDate(w.date)} — ${days(w.days)} early. You can still check them in.`;
    case 'earlyCheckOut':
      return `Booked until ${shortDate(w.date)} — leaving ${days(w.days)} early.`;
    case 'roomNotReady':
      return `Room ${String(w.roomNumber)} is marked ${w.status === 'out_of_service' ? 'out of service' : 'under maintenance'}. Choose another room or check with housekeeping.`;
  }
}

// Spec §4: refusals in words, danger/warning tone; a finished stay is neutral.
export function blockerText(b: Blocker): { message: string; tone: StatusTone } {
  switch (b.kind) {
    case 'cancelled':
      return { message: 'This booking was cancelled.', tone: 'danger' };
    case 'unpaid':
      return {
        message:
          "Payment hasn't been completed for this booking. The guest can pay on the Bookhushly app or website.",
        tone: 'warning',
      };
    case 'checkedOut': {
      const at = b.at === null ? '' : lagosTime(b.at);
      return {
        message: at === '' ? 'This guest has checked out.' : `This guest checked out at ${at}.`,
        tone: 'neutral',
      };
    }
  }
}

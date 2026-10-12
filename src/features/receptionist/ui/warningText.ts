import type { Blocker, Warning } from '@/features/receptionist/domain/bookingState';
import { lagosWhen, shortDate, type IsoDate } from '@/shared/lib/lagosDay';
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

export const CANCELLED_TEXT = 'This booking was cancelled.';
export const UNPAID_TEXT =
  "Payment hasn't been completed for this booking. The guest can pay on the Bookhushly app or website.";

// Spec §4: refusals in words, danger/warning tone; a finished stay is neutral. `today` (the desk's
// Lagos day) decides whether a time needs its date.
export function blockerText(b: Blocker, today: IsoDate): { message: string; tone: StatusTone } {
  switch (b.kind) {
    case 'cancelled':
      return { message: CANCELLED_TEXT, tone: 'danger' };
    case 'unpaid':
      return { message: UNPAID_TEXT, tone: 'warning' };
    case 'checkedOut': {
      const when = b.at === null ? '' : lagosWhen(b.at, today);
      return {
        message: when === '' ? 'This guest has checked out.' : `This guest checked out ${when}.`,
        tone: 'neutral',
      };
    }
  }
}

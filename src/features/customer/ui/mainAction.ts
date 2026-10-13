import { showCheckInCode } from '@/features/customer/domain/checkInCode';
import type { MyBooking } from '@/features/customer/domain/myBookings';
import { canShowTickets } from '@/features/customer/domain/tickets';
import type { BookingRows } from '@/features/customer/hooks/useMyBookings';

export type MainAction = 'tickets' | 'checkInCode' | 'open';

/**
 * The Today card's main action. With fresh rows the C6/C10 rules decide; a saved (wallet) entry
 * only carries tickets or a check-in code when those rules allowed them when it was saved.
 */
export function mainAction(b: MyBooking, rows: BookingRows | null): MainAction {
  if (rows !== null) {
    if (b.kind === 'event') {
      const r = rows.events.find((e) => e.id === b.id);
      return r !== undefined && canShowTickets(r) === 'show' ? 'tickets' : 'open';
    }
    if (b.kind === 'hotel') {
      const r = rows.hotels.find((h) => h.id === b.id);
      return r !== undefined && showCheckInCode(r) ? 'checkInCode' : 'open';
    }
    return 'open';
  }
  if (b.kind === 'event' && 'tickets' in b && Array.isArray(b.tickets) && b.tickets.length > 0)
    return 'tickets';
  if (
    b.kind === 'hotel' &&
    'checkInCode' in b &&
    typeof b.checkInCode === 'string' &&
    b.checkInCode !== ''
  )
    return 'checkInCode';
  return 'open';
}

import {
  blockedNights,
  bookedNights,
  planToggle,
  routeMonth,
  type Block,
  type Stay,
} from '@/features/vendor/domain/calendarBlocks';
import type { R, Requester } from '@/features/vendor/api/vendorHttpCommon';
import {
  blockCreatedBody,
  blockDeletedBody,
  blockedDatesBody,
} from '@/features/vendor/schemas/vendorApi';
import { isIsoDate, type IsoDate } from '@/shared/lib/lagosDay';
import { err, ok } from '@/shared/lib/result';

const ROUTE = '/api/vendor/apartments/blocked-dates';

export type CalendarMonth = { booked: IsoDate[]; blocked: IsoDate[] };

/** The apartment calendar (`/api/vendor/apartments/blocked-dates`). */
export function createCalendarHttp(c: Requester, clear: () => void) {
  async function read(apartmentId: string, month: IsoDate): R<{ blocks: Block[]; stays: Stay[] }> {
    const q = routeMonth(month);
    const r = await c.request(
      `${ROUTE}?apartment_id=${encodeURIComponent(apartmentId)}&year=${String(q.year)}&month=${String(q.month)}`,
      { schema: blockedDatesBody },
    );
    if (!r.ok) return r;
    // Dates come back as `YYYY-MM-DD`; anything else is dropped rather than drawn on a wrong day.
    const day = (s: string) => s.slice(0, 10);
    return ok({
      blocks: r.value.blocked
        .map((b) => ({ id: b.id, start: day(b.start_date), end: day(b.end_date) }))
        .filter((b) => isIsoDate(b.start) && isIsoDate(b.end)),
      stays: r.value.booked
        .map((s) => ({ checkIn: day(s.check_in_date), checkOut: day(s.check_out_date) }))
        .filter((s) => isIsoDate(s.checkIn) && isIsoDate(s.checkOut)),
    });
  }

  return {
    async calendar(apartmentId: string, month: IsoDate): R<CalendarMonth> {
      const r = await read(apartmentId, month);
      if (!r.ok) return r;
      return ok({
        booked: bookedNights(r.value.stays, month),
        blocked: blockedNights(r.value.blocks, month),
      });
    },

    /**
     * Blocks a free night or opens a blocked one; true when the night ends up blocked. Reads the
     * month fresh first, so it never acts on blocks another device has already changed.
     */
    async toggleBlocked(apartmentId: string, date: IsoDate): R<boolean> {
      clear();
      const fresh = await read(apartmentId, date);
      if (!fresh.ok) return fresh;
      const plan = planToggle(fresh.value.blocks, date);
      const create = (start: IsoDate, end: IsoDate) =>
        c.request(ROUTE, {
          method: 'POST',
          body: { apartment_id: apartmentId, start_date: start, end_date: end },
          schema: blockCreatedBody,
        });
      if (plan.kind === 'block') {
        // A guest's stay, paid or still being paid for (the route lists pending holds too), can't
        // be blocked over. Opening a blocked night is never refused for it.
        if (bookedNights(fresh.value.stays, date).includes(date))
          return err({ kind: 'conflict', code: 'date_booked' });
        const r = await create(plan.start, plan.end);
        // The route's only 409 is a confirmed stay over those dates.
        if (!r.ok)
          return r.error.kind === 'conflict' ? err({ kind: 'conflict', code: 'date_booked' }) : r;
        return ok(true);
      }
      // The nights either side go back first: if anything fails after this, a night stays blocked
      // (safe, and the vendor sees it), never opened by mistake.
      for (const piece of plan.create) {
        const r = await create(piece.start, piece.end);
        if (!r.ok)
          return r.error.kind === 'conflict' ? err({ kind: 'conflict', code: 'date_booked' }) : r;
      }
      for (const id of plan.remove) {
        const r = await c.request(`${ROUTE}?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          schema: blockDeletedBody,
        });
        if (!r.ok) return r;
      }
      return ok(false);
    },
  };
}

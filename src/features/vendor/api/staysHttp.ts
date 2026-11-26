import { stayFrom } from '@/features/vendor/api/mapVendor';

import type { ListingBooking, StayStatus } from '@/features/vendor/domain/listings';

import { type ServedKind } from '@/features/vendor/domain/vendorProfile';
import { moveBody, staysBody } from '@/features/vendor/schemas/vendorApi';

import { err, ok } from '@/shared/lib/result';
import type { R, Requester } from '@/features/vendor/api/vendorHttpCommon';

/** Hotel and apartment bookings (`/api/vendor/bookings`) and apartment status changes. */
export function createStaysHttp(c: Requester, clear: () => void) {
  async function stays(kind: ServedKind): R<ListingBooking[]> {
    const r = await c.request('/api/vendor/bookings', { schema: staysBody });
    if (!r.ok) return r;
    const want = kind === 'hotel' ? 'hotel' : 'apartment';
    return ok(
      r.value.bookings
        .map(stayFrom)
        .filter((b): b is ListingBooking => b !== null && b.kind === want),
    );
  }

  return {
    bookings: stays,

    async booking(kind: ServedKind, id: string): R<ListingBooking> {
      const r = await stays(kind);
      if (!r.ok) return r;
      const b = r.value.find((x) => x.id === id);
      return b === undefined ? err({ kind: 'notFound' }) : ok(b);
    },

    /** Apartments: confirm, decline, check in, check out. */
    async moveBooking(
      kind: ServedKind,
      id: string,
      from: StayStatus,
      to: StayStatus,
    ): R<ListingBooking> {
      if (kind !== 'apartment') return err({ kind: 'forbidden', code: 'wrong_category' });
      // The route checks the move against the status it reads, not the one the vendor saw: a
      // booking confirmed elsewhere a moment ago must not be cancelled by a stale "Decline". Read it
      // fresh and refuse if it moved (a small window remains until the web takes an expected status).
      clear();
      const fresh = await stays(kind);
      if (!fresh.ok) return fresh;
      const current = fresh.value.find((x) => x.id === id);
      if (current === undefined) return err({ kind: 'notFound' });
      if (current.status !== from) return err({ kind: 'conflict', code: 'stale_status' });
      const r = await c.request(`/api/vendor/apartment-bookings/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: { status: to },
        schema: moveBody,
      });
      if (!r.ok) return r;
      const after = await stays(kind);
      if (!after.ok) return after;
      const b = after.value.find((x) => x.id === id);
      if (b === undefined) return err({ kind: 'notFound' });
      // A paid stay's cancel refunds the guest; a refund that failed is finished by Bookhushly.
      const refunded = r.value.refunded;
      if (to === 'cancelled' && current.payment === 'paid' && refunded !== undefined)
        return ok({ ...b, refund: refunded ? 'onItsWay' : 'beingFinished' });
      return ok(b);
    },
  };
}

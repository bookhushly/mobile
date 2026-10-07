import { z } from 'zod';

import { dbErrorToApiError, type DbRes } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

export type ScannableEvent = {
  id: string;
  /** null when the listing is hidden from this scanner (draft/private) — show "Event · <short id>". */
  title: string | null;
  startsAt: string | null;
  location: string | null;
};

export type ScannerDb = {
  assignments(userId: string): Promise<DbRes>;
  vendorLinks(userId: string): Promise<DbRes>;
  isListingScanner(listingId: string, userId: string): Promise<DbRes>;
};

const listingRow = z.object({
  id: z.string(),
  title: z.string(),
  event_date: z.string().nullable(),
  event_time: z.string().nullable(),
  location: z.string().nullable(),
  vendor_id: z.string(),
});
const assignmentRows = z.array(
  z.object({ listing_id: z.string(), listing: listingRow.nullable() }),
);
const vendorRows = z.array(z.object({ vendor_id: z.string() }));

// Server rule (admit_ticket / is_listing_scanner): active event_scanners row AND an active
// vendor_scanners row for that listing's vendor.
export async function loadScannableEvents(
  db: ScannerDb,
  userId: string,
): Promise<Result<ScannableEvent[], ApiError>> {
  const [a, v] = await Promise.all([db.assignments(userId), db.vendorLinks(userId)]);
  if (a.error) return err(dbErrorToApiError(a.error));
  if (v.error) return err(dbErrorToApiError(v.error));
  const rows = assignmentRows.safeParse(a.data);
  const vendors = vendorRows.safeParse(v.data);
  if (!rows.success || !vendors.success) return err({ kind: 'validation' });

  const activeVendors = new Set(vendors.data.map((r) => r.vendor_id));
  if (activeVendors.size === 0) return ok([]);

  const seen = new Set<string>();
  const events: ScannableEvent[] = [];
  const hidden: string[] = [];
  for (const row of rows.data) {
    if (seen.has(row.listing_id)) continue;
    seen.add(row.listing_id);
    const l = row.listing;
    if (l === null) hidden.push(row.listing_id);
    else if (activeVendors.has(l.vendor_id)) {
      events.push({
        id: l.id,
        title: l.title,
        startsAt: l.event_time ?? l.event_date,
        location: l.location,
      });
    }
  }

  const checks = await Promise.all(hidden.map((id) => db.isListingScanner(id, userId)));
  for (const [i, c] of checks.entries()) {
    if (c.error) return err(dbErrorToApiError(c.error));
    const id = hidden[i];
    if (c.data === true && id !== undefined) {
      events.push({ id, title: null, startsAt: null, location: null });
    }
  }
  return ok(events);
}

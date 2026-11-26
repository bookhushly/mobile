import { z } from 'zod';

import type { VendorApartment } from '@/features/vendor/domain/calendarBlocks';
import { APARTMENT_COLUMNS, apartmentRow } from '@/features/vendor/schemas/vendorApi';
import { toVendorProfile, VENDOR_COLUMNS, vendorRow } from '@/features/vendor/schemas/vendorRow';
import type { VendorProfile } from '@/features/vendor/domain/vendorProfile';
import { dbErrorToApiError } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';
import { wrap } from '@/shared/supabase/wrap';

type DbRow = { data: unknown; error: { code?: string } | null; status: number };
type VendorQuery = {
  eq(column: string, value: string): PromiseLike<DbRow> & { maybeSingle(): PromiseLike<DbRow> };
};
export type SupabaseLike = { from(table: string): { select(columns: string): VendorQuery } };

const maybeVendor = vendorRow.nullable();
const apartmentRows = z.array(apartmentRow);

/**
 * The signed-in user's vendor profile, or null when they have no vendors row yet (signed up as a
 * vendor but never finished the web form). Replaced by `GET /api/vendor/me` once the web ships it.
 */
export function createVendorDb(client: SupabaseLike) {
  return {
    async me(userId: string): Promise<Result<VendorProfile | null, ApiError>> {
      const r = await wrap(
        client.from('vendors').select(VENDOR_COLUMNS).eq('user_id', userId).maybeSingle(),
      );
      if (r.error) return err(dbErrorToApiError(r.error));
      const p = maybeVendor.safeParse(r.data);
      if (!p.success) return err({ kind: 'validation' });
      return ok(p.data === null ? null : toVendorProfile(p.data));
    },

    /** The vendor's apartments for the calendar, live ones first, then by name. */
    async apartments(vendorId: string): Promise<Result<VendorApartment[], ApiError>> {
      const r = await wrap(
        client.from('serviced_apartments').select(APARTMENT_COLUMNS).eq('vendor_id', vendorId),
      );
      if (r.error) return err(dbErrorToApiError(r.error));
      const p = apartmentRows.safeParse(r.data);
      if (!p.success) return err({ kind: 'validation' });
      const live = (s: string | null) => (s === 'active' ? 0 : 1);
      return ok(
        [...p.data]
          .sort((a, b) => live(a.status) - live(b.status) || a.name.localeCompare(b.name))
          .map((a) => ({ id: a.id, name: a.name.trim() })),
      );
    },
  };
}

// Pinning the result type to `unknown` stops supabase-js parsing the column string at the type
// level (as deskDb does); the row is validated with zod above.
const live: SupabaseLike = {
  from: (table) => ({ select: (columns) => supabase.from(table).select<string, unknown>(columns) }),
};
export const vendorDb = createVendorDb(live);

import type { ModeInputs } from '@/features/mode/domain/resolveMode';
import { hotelStaffRow, profileRow, vendorCategoryRow } from '@/features/mode/schemas/rows';
import { dbErrorToApiError, type DbRes } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

export type ModeDb = {
  profile(userId: string): Promise<DbRes>;
  hotelStaff(userId: string): Promise<DbRes>;
  scannableEvents(userId: string): Promise<Result<readonly unknown[], ApiError>>;
  /** The vendor's `business_category` (vendors only; RLS lets them read their own row). */
  vendorCategory(userId: string): Promise<DbRes>;
};

export async function loadModeInputs(
  db: ModeDb,
  userId: string,
  opts: { vendorMode: boolean } = { vendorMode: true },
): Promise<Result<ModeInputs, ApiError>> {
  const [p, h, s] = await Promise.all([
    db.profile(userId),
    db.hotelStaff(userId),
    db.scannableEvents(userId),
  ]);
  if (p.error) return err(dbErrorToApiError(p.error));
  if (h.error) return err(dbErrorToApiError(h.error));
  if (!s.ok) return err(s.error);
  if (p.data === null) return err({ kind: 'notFound' });
  const profile = profileRow.safeParse(p.data);
  const staff = hotelStaffRow.safeParse(h.data);
  if (!profile.success || !staff.success) return err({ kind: 'validation' });
  const base = {
    role: profile.data.role,
    hotelStaff: staff.data[0] ? { hotelId: staff.data[0].hotel_id } : null,
    activeScannerCount: s.value.length,
  };
  // With vendor mode off a vendor gets the web dashboard: their business doesn't need reading.
  if (profile.data.role !== 'vendor' || !opts.vendorMode) return ok(base);
  const v = await db.vendorCategory(userId);
  if (v.error) return err(dbErrorToApiError(v.error));
  const row = vendorCategoryRow.safeParse(v.data);
  if (!row.success) return err({ kind: 'validation' });
  return ok({ ...base, ownsHotel: row.data?.business_category === 'hotels' });
}

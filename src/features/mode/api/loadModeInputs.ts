import type { ModeInputs } from '@/features/mode/domain/resolveMode';
import { hotelStaffRow, profileRow } from '@/features/mode/schemas/rows';
import { dbErrorToApiError, type DbRes } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

export type ModeDb = {
  profile(userId: string): Promise<DbRes>;
  hotelStaff(userId: string): Promise<DbRes>;
  scannableEvents(userId: string): Promise<Result<readonly unknown[], ApiError>>;
};

export async function loadModeInputs(
  db: ModeDb,
  userId: string,
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
  return ok({
    role: profile.data.role,
    hotelStaff: staff.data ? { hotelId: staff.data.hotel_id } : null,
    activeScannerCount: s.value.length,
  });
}

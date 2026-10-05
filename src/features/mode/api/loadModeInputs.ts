import type { ModeInputs } from '@/features/mode/domain/resolveMode';
import { hotelStaffRow, profileRow, scannerRows } from '@/features/mode/schemas/rows';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

type Res = { data: unknown; error: { code?: string; status?: number } | null };

export type ModeDb = {
  profile(userId: string): Promise<Res>;
  hotelStaff(userId: string): Promise<Res>;
  activeScanners(userId: string): Promise<Res>;
};

function toApiError(e: { code?: string; status?: number }): ApiError {
  if (e.status === 401 || e.status === 403) return { kind: 'forbidden' };
  if (typeof e.status === 'number' && e.status >= 500) {
    return { kind: 'unavailable', status: e.status };
  }
  if (e.status === undefined || e.status === 0) return { kind: 'network' };
  return { kind: 'unknown', status: e.status };
}

export async function loadModeInputs(
  db: ModeDb,
  userId: string,
): Promise<Result<ModeInputs, ApiError>> {
  const [p, h, s] = await Promise.all([
    db.profile(userId),
    db.hotelStaff(userId),
    db.activeScanners(userId),
  ]);
  if (p.error) return err(toApiError(p.error));
  if (h.error) return err(toApiError(h.error));
  if (s.error) return err(toApiError(s.error));
  if (p.data === null) return err({ kind: 'notFound' });
  const profile = profileRow.safeParse(p.data);
  const staff = hotelStaffRow.safeParse(h.data);
  const scanners = scannerRows.safeParse(s.data);
  if (!profile.success || !staff.success || !scanners.success) return err({ kind: 'validation' });
  return ok({
    role: profile.data.role,
    hotelStaff: staff.data ? { hotelId: staff.data.hotel_id } : null,
    activeScannerCount: scanners.data.length,
  });
}

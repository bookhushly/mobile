import { z } from 'zod';

import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

import type { ApiClient } from './client';

const kycResponse = z.object({ kyc: z.unknown() });

/**
 * Dev-only proof that Bearer auth + the API client work end to end.
 * GET /api/customer/kyc → 200 { kyc: null | {...} }; 401 { status: null } (verified in web source).
 */
export async function probeAuthedCall(
  api: Pick<ApiClient, 'request'>,
): Promise<Result<{ hasKyc: boolean }, ApiError>> {
  const r = await api.request('/api/customer/kyc', { schema: kycResponse });
  if (!r.ok) return err(r.error);
  return ok({ hasKyc: r.value.kyc !== null && r.value.kyc !== undefined });
}

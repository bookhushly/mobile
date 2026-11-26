import { z } from 'zod';

import {
  vendorKind,
  vendorStanding,
  type VendorProfile,
} from '@/features/vendor/domain/vendorProfile';

// RLS lets a vendor read their own row. Explicit columns only: no bank, ID or contact fields.
export const VENDOR_COLUMNS =
  'id, business_name, business_category, approved, status, suspended_at, rejection_reason';

export const vendorRow = z.object({
  id: z.string(),
  business_name: z.string(),
  business_category: z.string().nullable(),
  approved: z.boolean().nullable(),
  status: z.string().nullable(),
  suspended_at: z.string().nullable(),
  rejection_reason: z.string().nullable(),
});
export type VendorRow = z.infer<typeof vendorRow>;

export function toVendorProfile(r: VendorRow): VendorProfile {
  return {
    id: r.id,
    name: r.business_name.trim(),
    kind: vendorKind(r.business_category),
    standing: vendorStanding({
      approved: r.approved === true,
      status: r.status,
      suspendedAt: r.suspended_at,
      rejectionReason: r.rejection_reason,
    }),
  };
}

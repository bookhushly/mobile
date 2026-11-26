// Who a vendor is, as vendor mode needs it (DECISION-11). Pure: the vendors row is parsed in
// schemas/ and mapped here.

/** The business kinds vendor mode serves; `other` gets the web dashboard. */
export type VendorKind =
  'carRental' | 'logistics' | 'security' | 'hotel' | 'apartment' | 'event' | 'other';

/** `vendors.business_category` values as the web writes them. */
export function vendorKind(category: string | null): VendorKind {
  switch (category) {
    case 'car_rental':
      return 'carRental';
    case 'logistics':
      return 'logistics';
    case 'security':
      return 'security';
    case 'hotels':
      return 'hotel';
    case 'serviced_apartments':
      return 'apartment';
    case 'events':
      return 'event';
    case null:
      return 'other';
    default:
      return 'other';
  }
}

export type ServedKind = Exclude<VendorKind, 'other'>;

/** The kind, when the app runs that kind of business; null sends the vendor to the web. */
export const servedKind = (k: VendorKind): ServedKind | null => (k === 'other' ? null : k);

/** Request-for-quote businesses quote on requests and are paid into a wallet. */
export const isQuoteKind = (k: VendorKind) =>
  k === 'carRental' || k === 'logistics' || k === 'security';

export type Standing =
  | { kind: 'ready' }
  | { kind: 'waiting' }
  | { kind: 'rejected'; reason: string | null }
  | { kind: 'suspended' };

type StandingInput = {
  approved: boolean;
  status: string | null;
  suspendedAt: string | null;
  rejectionReason?: string | null;
};

/** Where the account stands. The server re-checks all of it on every vendor action. */
export function vendorStanding(v: StandingInput): Standing {
  if (v.suspendedAt !== null) return { kind: 'suspended' };
  if (v.approved) return { kind: 'ready' };
  if (v.status === 'rejected') return { kind: 'rejected', reason: v.rejectionReason ?? null };
  return { kind: 'waiting' };
}

export type VendorProfile = {
  id: string;
  name: string;
  kind: VendorKind;
  standing: Standing;
};

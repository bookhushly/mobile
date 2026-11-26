import type { ServedKind } from './vendorProfile';

/** Every vendor tab route; each kind of business shows five of them (design v13). */
export const VENDOR_TABS = [
  'today',
  'requests',
  'jobs',
  'bookings',
  'rooms',
  'calendar',
  'events',
  'scan',
  'earnings',
  'account',
] as const;
export type VendorTab = (typeof VENDOR_TABS)[number];

export function vendorTabs(kind: ServedKind): VendorTab[] {
  switch (kind) {
    case 'carRental':
    case 'logistics':
    case 'security':
      return ['today', 'requests', 'jobs', 'earnings', 'account'];
    case 'hotel':
      return ['today', 'bookings', 'rooms', 'earnings', 'account'];
    case 'apartment':
      return ['today', 'bookings', 'calendar', 'earnings', 'account'];
    case 'event':
      return ['today', 'events', 'scan', 'earnings', 'account'];
  }
}

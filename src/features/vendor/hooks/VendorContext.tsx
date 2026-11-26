import { createContext, useContext, type ReactNode } from 'react';

import type { ServedKind, VendorProfile } from '@/features/vendor/domain/vendorProfile';

// What every vendor screen needs: the business, and the layout-owned actions.
export type VendorSession = {
  userId: string;
  vendor: VendorProfile & { kind: ServedKind };
  email: string;
  /** Opens bookhushly.com, at a page when given one (e.g. `/vendor/dashboard/fleet`). */
  openWeb: (path?: string) => void;
  /** Switch to booking as a customer; null when the account has no customer mode. */
  switchToBooking: (() => void) | null;
  /** Gate mode (scanning): event owners have it for their own events. Null when not available. */
  switchToGate: (() => void) | null;
  /** The front desk (hotel check-in and rooms). Null until it opens to hotel owners. */
  switchToDesk: (() => void) | null;
  signOut: () => void;
};

const Ctx = createContext<VendorSession | null>(null);

export function VendorProvider({ value, children }: { value: VendorSession; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVendorSession(): VendorSession {
  const v = useContext(Ctx);
  if (v === null) throw new Error('useVendorSession must be used inside VendorProvider');
  return v;
}

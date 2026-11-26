export type Role = 'customer' | 'vendor' | 'admin' | 'receptionist' | 'support';
export type Mode = 'customer' | 'gate' | 'receptionist' | 'vendor';

export type ModeInputs = {
  role: Role;
  hotelStaff: { hotelId: string } | null;
  activeScannerCount: number;
  /** Vendors only: their business is hotels, so they also run the front desk (DECISION-11). */
  ownsHotel?: boolean;
};

export type ModeResolution =
  { kind: 'webOnly' } | { kind: 'modes'; modes: Mode[]; defaultMode: Mode };

export type ModeOptions = {
  /** Vendor mode (DECISION-11) is built but off in production until the web vendor routes ship. */
  vendorMode: boolean;
};

export function resolveMode(
  i: ModeInputs,
  lastMode: Mode | null = null,
  opts: ModeOptions = { vendorMode: false },
): ModeResolution {
  if (i.role === 'admin' || i.role === 'support') return { kind: 'webOnly' };
  if (i.role === 'vendor' && !opts.vendorMode) return { kind: 'webOnly' };
  const modes: Mode[] = [];
  // A vendor lands on their business; owners can scan their own events and still book as anyone.
  if (i.role === 'vendor') modes.push('vendor');
  // Hotel owners check guests in and manage rooms on the same front desk as their staff.
  if (i.role === 'vendor' && i.ownsHotel === true) modes.push('receptionist');
  // A receptionist always lands on the front desk; without a hotel_staff row the desk explains.
  if (i.role === 'receptionist') modes.push('receptionist');
  if (i.activeScannerCount > 0) modes.push('gate');
  if (i.role === 'customer' || i.role === 'vendor') modes.push('customer');
  const preferred = lastMode && modes.includes(lastMode) ? lastMode : null;
  return { kind: 'modes', modes, defaultMode: preferred ?? modes[0] ?? 'customer' };
}

export function parseMode(v: string | null): Mode | null {
  return v === 'customer' || v === 'gate' || v === 'receptionist' || v === 'vendor' ? v : null;
}

export type Role = 'customer' | 'vendor' | 'admin' | 'receptionist' | 'support';
export type Mode = 'customer' | 'gate' | 'receptionist';

export type ModeInputs = {
  role: Role;
  hotelStaff: { hotelId: string } | null;
  activeScannerCount: number;
};

export type ModeResolution =
  { kind: 'webOnly' } | { kind: 'modes'; modes: Mode[]; defaultMode: Mode };

export function resolveMode(i: ModeInputs, lastMode: Mode | null = null): ModeResolution {
  if (i.role === 'vendor' || i.role === 'admin' || i.role === 'support') {
    return { kind: 'webOnly' };
  }
  const modes: Mode[] = [];
  if (i.role === 'receptionist' && i.hotelStaff) modes.push('receptionist');
  if (i.activeScannerCount > 0) modes.push('gate');
  modes.push('customer');
  const preferred = lastMode && modes.includes(lastMode) ? lastMode : null;
  return { kind: 'modes', modes, defaultMode: preferred ?? modes[0] ?? 'customer' };
}

export function parseMode(v: string | null): Mode | null {
  return v === 'customer' || v === 'gate' || v === 'receptionist' ? v : null;
}

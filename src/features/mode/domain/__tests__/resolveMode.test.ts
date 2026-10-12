import { resolveMode } from '@/features/mode/domain/resolveMode';

const base = { hotelStaff: null, activeScannerCount: 0 } as const;

describe('resolveMode', () => {
  it.each(['vendor', 'admin', 'support'] as const)('%s -> web only', (role) => {
    expect(resolveMode({ ...base, role })).toEqual({ kind: 'webOnly' });
  });
  it('receptionist with a hotel_staff row -> receptionist only (no customer mode)', () => {
    expect(
      resolveMode({ role: 'receptionist', hotelStaff: { hotelId: 'h' }, activeScannerCount: 0 }),
    ).toEqual({ kind: 'modes', modes: ['receptionist'], defaultMode: 'receptionist' });
  });
  it('receptionist WITHOUT a hotel_staff row still lands on the front desk (it explains there)', () => {
    expect(resolveMode({ ...base, role: 'receptionist' })).toEqual({
      kind: 'modes',
      modes: ['receptionist'],
      defaultMode: 'receptionist',
    });
  });
  it('receptionist who also scans -> receptionist then gate', () => {
    expect(
      resolveMode({ role: 'receptionist', hotelStaff: { hotelId: 'a' }, activeScannerCount: 1 }),
    ).toEqual({ kind: 'modes', modes: ['receptionist', 'gate'], defaultMode: 'receptionist' });
  });
  it('active scanner assignment -> gate (and customer stays available)', () => {
    expect(resolveMode({ ...base, role: 'customer', activeScannerCount: 2 })).toEqual({
      kind: 'modes',
      modes: ['gate', 'customer'],
      defaultMode: 'gate',
    });
  });
  it('plain customer -> customer only', () => {
    expect(resolveMode({ ...base, role: 'customer' })).toEqual({
      kind: 'modes',
      modes: ['customer'],
      defaultMode: 'customer',
    });
  });
  it('honours the remembered mode only when it is still available', () => {
    const inputs = { role: 'customer', hotelStaff: null, activeScannerCount: 1 } as const;
    expect(resolveMode(inputs, 'customer')).toMatchObject({ defaultMode: 'customer' });
    expect(resolveMode(inputs, 'receptionist')).toMatchObject({ defaultMode: 'gate' });
  });
});

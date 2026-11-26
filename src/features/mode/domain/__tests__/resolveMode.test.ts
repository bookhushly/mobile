import { resolveMode } from '@/features/mode/domain/resolveMode';

const base = { hotelStaff: null, activeScannerCount: 0 } as const;

describe('resolveMode', () => {
  it.each(['vendor', 'admin', 'support'] as const)('%s -> web only', (role) => {
    expect(resolveMode({ ...base, role })).toEqual({ kind: 'webOnly' });
  });
  it('admin and support stay web only even with vendor mode on', () => {
    expect(resolveMode({ ...base, role: 'admin' }, null, { vendorMode: true })).toEqual({
      kind: 'webOnly',
    });
    expect(resolveMode({ ...base, role: 'support' }, null, { vendorMode: true })).toEqual({
      kind: 'webOnly',
    });
  });
  it('vendor with vendor mode on -> vendor first, and they can still book as a customer', () => {
    expect(resolveMode({ ...base, role: 'vendor' }, null, { vendorMode: true })).toEqual({
      kind: 'modes',
      modes: ['vendor', 'customer'],
      defaultMode: 'vendor',
    });
  });
  it('a hotel vendor also gets the front desk, after their business', () => {
    expect(
      resolveMode({ ...base, role: 'vendor', ownsHotel: true }, null, { vendorMode: true }),
    ).toEqual({
      kind: 'modes',
      modes: ['vendor', 'receptionist', 'customer'],
      defaultMode: 'vendor',
    });
  });
  it('the front desk for owners is part of vendor mode: off with it', () => {
    expect(resolveMode({ ...base, role: 'vendor', ownsHotel: true })).toEqual({ kind: 'webOnly' });
  });
  it('a vendor who owns events can also scan them', () => {
    expect(
      resolveMode({ ...base, role: 'vendor', activeScannerCount: 1 }, 'customer', {
        vendorMode: true,
      }),
    ).toEqual({ kind: 'modes', modes: ['vendor', 'gate', 'customer'], defaultMode: 'customer' });
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

import { vendorStanding, vendorKind } from '@/features/vendor/domain/vendorProfile';

describe('vendorKind', () => {
  it.each([
    ['car_rental', 'carRental'],
    ['logistics', 'logistics'],
    ['security', 'security'],
    ['hotels', 'hotel'],
    ['serviced_apartments', 'apartment'],
    ['events', 'event'],
  ] as const)('%s -> %s', (category, kind) => {
    expect(vendorKind(category)).toBe(kind);
  });

  it('an unknown or missing category is not one the app can serve yet', () => {
    expect(vendorKind('restaurants')).toBe('other');
    expect(vendorKind(null)).toBe('other');
  });
});

describe('vendorStanding', () => {
  const ok = { approved: true, status: 'approved', suspendedAt: null, rejectionReason: null };

  it('approved and not suspended -> ready', () => {
    expect(vendorStanding(ok)).toEqual({ kind: 'ready' });
  });

  it('suspension wins over approval', () => {
    expect(vendorStanding({ ...ok, suspendedAt: '2026-11-20T10:00:00Z' })).toEqual({
      kind: 'suspended',
    });
  });

  it('rejected carries the reason, when there is one', () => {
    expect(
      vendorStanding({ ...ok, approved: false, status: 'rejected', rejectionReason: 'Blurry ID' }),
    ).toEqual({ kind: 'rejected', reason: 'Blurry ID' });
    expect(vendorStanding({ ...ok, approved: false, status: 'rejected' })).toEqual({
      kind: 'rejected',
      reason: null,
    });
  });

  it('anything else not yet approved is waiting (pending, submitted, reviewing, unknown)', () => {
    for (const status of ['pending', 'submitted', 'reviewing', null]) {
      expect(vendorStanding({ ...ok, approved: false, status })).toEqual({ kind: 'waiting' });
    }
  });
});

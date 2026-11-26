import { VENDOR_TABS, vendorTabs } from '@/features/vendor/domain/vendorTabs';

describe('vendorTabs', () => {
  it.each(['carRental', 'logistics', 'security'] as const)('%s quotes and runs jobs', (k) => {
    expect(vendorTabs(k)).toEqual(['today', 'requests', 'jobs', 'earnings', 'account']);
  });
  it('hotel: bookings and rooms', () => {
    expect(vendorTabs('hotel')).toEqual(['today', 'bookings', 'rooms', 'earnings', 'account']);
  });
  it('apartment: bookings and calendar', () => {
    expect(vendorTabs('apartment')).toEqual([
      'today',
      'bookings',
      'calendar',
      'earnings',
      'account',
    ]);
  });
  it('event: events and scan', () => {
    expect(vendorTabs('event')).toEqual(['today', 'events', 'scan', 'earnings', 'account']);
  });
  it('every kind has five tabs, all of them known routes', () => {
    for (const k of [
      'carRental',
      'logistics',
      'security',
      'hotel',
      'apartment',
      'event',
    ] as const) {
      const t = vendorTabs(k);
      expect(t).toHaveLength(5);
      for (const name of t) expect(VENDOR_TABS).toContain(name);
    }
  });
});

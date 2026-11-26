import { accountLinks } from '@/features/vendor/domain/accountLinks';

describe('accountLinks', () => {
  it('car rental and logistics manage vehicles and drivers', () => {
    expect(accountLinks('logistics').map((l) => l.title)).toEqual([
      'Vehicles and drivers',
      'Business profile and areas',
      'Bank account',
      'Help',
    ]);
  });
  it('security manages guards', () => {
    expect(accountLinks('security')[0]).toEqual({
      title: 'Guards',
      detail: 'Add and edit your guards',
      path: '/vendor/dashboard/profile',
    });
  });
  it('listing businesses manage their listings; events also their gate staff', () => {
    expect(accountLinks('hotel')[0]?.path).toBe('/vendor/dashboard/hotels');
    expect(accountLinks('apartment')[0]?.path).toBe('/vendor/dashboard/serviced-apartments');
    expect(accountLinks('event').map((l) => l.title)).toEqual([
      'Events',
      'Gate staff',
      'Business profile',
      'Bank account',
      'Help',
    ]);
  });
  it('every link is a dashboard page on the web', () => {
    for (const k of ['carRental', 'logistics', 'security', 'hotel', 'apartment', 'event'] as const)
      for (const l of accountLinks(k)) expect(l.path).toMatch(/^\/vendor\/dashboard\//);
  });
});

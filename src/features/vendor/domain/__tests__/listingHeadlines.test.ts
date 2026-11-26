import { eventHeadline, stayHeadline } from '@/features/vendor/domain/listingHeadlines';

describe('stayHeadline', () => {
  it('hotel: arrivals and departures', () => {
    expect(stayHeadline('hotel', { arriving: 4, arrived: 1, leaving: 2, toConfirm: 0 })).toEqual([
      '4 arriving today,',
      '2 leaving',
    ]);
    expect(stayHeadline('hotel', { arriving: 0, arrived: 0, leaving: 0, toConfirm: 0 })).toEqual([
      'No arrivals today',
    ]);
  });
  it('apartment: what waits for an answer leads', () => {
    expect(
      stayHeadline('apartment', { arriving: 1, arrived: 0, leaving: 1, toConfirm: 2 }),
    ).toEqual(['2 bookings to confirm,', '1 check-in today']);
    expect(
      stayHeadline('apartment', { arriving: 0, arrived: 0, leaving: 0, toConfirm: 1 }),
    ).toEqual(['1 booking to confirm']);
    expect(
      stayHeadline('apartment', { arriving: 0, arrived: 0, leaving: 0, toConfirm: 0 }),
    ).toEqual(['No check-ins today']);
  });
});

describe('eventHeadline', () => {
  const NOW = Date.parse('2026-11-29T07:20:00Z');
  it('how far off the next event is, in Lagos days', () => {
    expect(eventHeadline('Lagos Jazz Night', '2026-12-01T18:00:00Z', NOW)).toEqual([
      'Lagos Jazz Night',
      'is in 2 days',
    ]);
    expect(eventHeadline('Brunch', '2026-11-30T10:00:00Z', NOW)).toEqual(['Brunch', 'is tomorrow']);
    expect(eventHeadline('Brunch', '2026-11-29T18:00:00Z', NOW)).toEqual(['Brunch', 'is today']);
    expect(eventHeadline(null, null, NOW)).toEqual(['No events coming up']);
  });
});

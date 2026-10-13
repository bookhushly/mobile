import {
  dayAt,
  eventWhen,
  guestsCount,
  guestsLine,
  joinAddress,
  mapsUrl,
  nightsLabel,
  packagesLine,
} from '@/features/customer/domain/detailText';

it('lists ticket packages', () => {
  expect(packagesLine({ VIP: 2, Regular: 1 })).toBe('2 × VIP, 1 × Regular');
  expect(packagesLine({ VIP: 0, '': 3, Odd: 1.5 })).toBeNull();
  expect(packagesLine({})).toBeNull();
  expect(packagesLine(null)).toBeNull();
});

it('says who is staying', () => {
  expect(guestsLine(2, 1)).toBe('2 adults, 1 child');
  expect(guestsLine(1, 0)).toBe('1 adult');
  expect(guestsLine(1, 3)).toBe('1 adult, 3 children');
  expect(guestsLine(null, null)).toBeNull();
  expect(guestsCount(3)).toBe('3 guests');
  expect(guestsCount(1)).toBe('1 guest');
  expect(guestsCount(null)).toBeNull();
  expect(nightsLabel(1)).toBe('1 night');
  expect(nightsLabel(2)).toBe('2 nights');
});

it('opens Apple Maps on iOS and Google Maps elsewhere, encoded', () => {
  expect(mapsUrl('Eko Hotel, Lagos', 'ios')).toBe(
    'https://maps.apple.com/?q=Eko%20Hotel%2C%20Lagos',
  );
  expect(mapsUrl(' 1 Ade & Co St ', 'android')).toBe(
    'https://maps.google.com/?q=1%20Ade%20%26%20Co%20St',
  );
});

it('writes days with their times', () => {
  expect(dayAt('2026-10-18', '19:00:00')).toBe('Sun 18 Oct · 7:00 pm');
  expect(dayAt('2026-10-15', '14:00', 'from')).toBe('Thu 15 Oct · from 2:00 pm');
  expect(dayAt('2026-10-17', '12:00:00', 'by')).toBe('Sat 17 Oct · by 12:00 pm');
  expect(dayAt('2026-10-17', null, 'by')).toBe('Sat 17 Oct');
  expect(eventWhen('2026-10-18', '2026-10-18', '19:00')).toBe('Sun 18 Oct · 7:00 pm');
  expect(eventWhen('2026-10-18', '2026-10-19', '19:00')).toBe('Sun 18 Oct – Mon 19 Oct · 7:00 pm');
  expect(eventWhen('2026-10-18', '2026-10-19', null)).toBe('Sun 18 Oct – Mon 19 Oct');
});

it('joins the address parts that exist', () => {
  expect(joinAddress(['12 Marina Rd', null, ' Lagos ', ''])).toBe('12 Marina Rd, Lagos');
  expect(joinAddress([null, undefined, ' '])).toBeNull();
});

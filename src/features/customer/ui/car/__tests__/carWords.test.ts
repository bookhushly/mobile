import {
  carName,
  dateRange,
  guideWords,
  routeWords,
  timeWords,
} from '@/features/customer/ui/car/carWords';

describe('car words', () => {
  it('reads times on a 12-hour clock', () => {
    expect(timeWords('09:00')).toBe('9:00 am');
    expect(timeWords('12:30')).toBe('12:30 pm');
    expect(timeWords('00:15')).toBe('12:15 am');
    expect(timeWords('18:00')).toBe('6:00 pm');
  });

  it('shortens a range within one month', () => {
    expect(dateRange('2026-12-04', '2026-12-06')).toBe('Fri 4 → Sun 6 Dec');
    expect(dateRange('2026-12-31', '2027-01-02')).toBe('Thu 31 Dec → Sat 2 Jan');
    expect(dateRange('2026-12-04', '2026-12-04')).toBe('Fri 4 Dec');
    expect(dateRange('2026-12-04', null)).toBe('Fri 4 Dec');
  });

  it('names the route, leaving out an end in the same state', () => {
    const r = { pickupAddress: 'Allen Avenue', pickupState: 'Lagos', destinationState: 'Ogun' };
    expect(routeWords(r)).toBe('Allen Avenue, Lagos → Ogun');
    expect(routeWords({ ...r, destinationState: 'Lagos' })).toBe('Allen Avenue, Lagos');
    expect(routeWords({ ...r, pickupAddress: null, destinationState: null })).toBe('Lagos');
  });

  it('names a car, or its type when the company left the car out', () => {
    expect(carName({ make: 'Toyota', model: 'Camry', year: 2019 }, 'sedan')).toBe(
      'Toyota Camry 2019',
    );
    expect(carName(null, 'suv')).toBe('SUV or jeep');
    expect(carName({ make: ' ', model: null, year: null }, null)).toBe('Car');
  });

  it('words a guide price with its unit', () => {
    expect(guideWords({ min: 35000, max: 55000 }, 'full_day')).toBe('About ₦35,000–₦55,000 a day');
    expect(guideWords({ min: 90000, max: 90000 }, 'fixed')).toBe('About ₦90,000');
  });
});

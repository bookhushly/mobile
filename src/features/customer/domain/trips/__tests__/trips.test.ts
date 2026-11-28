import {
  canComplete,
  crossSell,
  openTrip,
  EMPTY_TRIP,
  linkTargets,
  stateOfDestination,
  tripDestinationOf,
  missingServices,
  progressLine,
  tripWhen,
  suggestName,
  TRIP_SERVICES,
  tripProgress,
  tripStepReady,
  type Trip,
} from '@/features/customer/domain/trips/trips';

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Lagos trip, December',
  destination: 'Lagos',
  startDate: '2026-12-18',
  endDate: '2026-12-22',
  status: 'planning',
  notes: null,
  createdAt: '2026-11-26T10:00:00Z',
  services: [
    { id: 's1', type: 'hotel', status: 'booked' },
    { id: 's2', type: 'car_rental', status: 'planned' },
  ],
  ...over,
});

describe('the services a trip can hold', () => {
  it('are the web’s six, instant ones first, in its order', () => {
    expect(TRIP_SERVICES.map((s) => s.type)).toEqual([
      'hotel',
      'apartment',
      'event',
      'car_rental',
      'logistics',
      'security',
    ]);
    expect(TRIP_SERVICES.filter((s) => s.group === 'quotes').map((s) => s.type)).toEqual([
      'car_rental',
      'logistics',
      'security',
    ]);
  });
});

describe('tripStepReady', () => {
  it('where and when can be skipped; services needs one; the name can’t be blank', () => {
    expect(tripStepReady('where', EMPTY_TRIP)).toBe(true);
    expect(tripStepReady('when', EMPTY_TRIP)).toBe(true);
    expect(tripStepReady('services', EMPTY_TRIP)).toBe(false);
    expect(tripStepReady('services', { ...EMPTY_TRIP, services: ['hotel'] })).toBe(true);
    expect(tripStepReady('name', { ...EMPTY_TRIP, services: ['hotel'], name: '  ' })).toBe(false);
    expect(tripStepReady('name', { ...EMPTY_TRIP, services: ['hotel'], name: 'Abuja' })).toBe(true);
  });
});

describe('suggestName (the web’s wording)', () => {
  it('uses the place and the month it starts', () => {
    expect(suggestName('Lagos', '2026-12-18')).toBe('Lagos trip, December');
    expect(suggestName('FCT Abuja', null)).toBe('Abuja trip');
    expect(suggestName(null, null)).toBe('My trip');
  });
});

describe('a trip’s progress', () => {
  it('counts booked and confirmed services out of all of them', () => {
    expect(tripProgress(trip())).toEqual({ booked: 1, total: 2 });
    expect(
      tripProgress(trip({ services: [{ id: 's1', type: 'hotel', status: 'confirmed' }] })),
    ).toEqual({ booked: 1, total: 1 });
  });
  it('lists the services not on it yet, in the usual order', () => {
    expect(missingServices(trip())).toEqual(['apartment', 'event', 'logistics', 'security']);
  });
  it('can be marked complete only while planning, once every service is booked', () => {
    expect(canComplete(trip())).toBe(false);
    const done = trip({ services: [{ id: 's1', type: 'hotel', status: 'booked' }] });
    expect(canComplete(done)).toBe(true);
    expect(canComplete({ ...done, status: 'completed' })).toBe(false);
    expect(canComplete(trip({ services: [] }))).toBe(false);
  });
});

describe('linkTargets', () => {
  it('offers open trips that still plan this kind of booking', () => {
    const trips = [
      trip(),
      trip({ id: 't2', name: 'Done', status: 'completed' }),
      trip({
        id: 't3',
        name: 'Car booked',
        services: [{ id: 's9', type: 'car_rental', status: 'booked' }],
      }),
    ];
    expect(linkTargets(trips, 'car_rental')).toEqual([
      { tripServiceId: 's2', tripName: 'Lagos trip, December', destination: 'Lagos' },
    ]);
    expect(linkTargets(trips, 'hotel')).toEqual([]);
  });
});

describe('destinations', () => {
  it('store FCT as the web does, and open results with the app’s state name', () => {
    expect(tripDestinationOf('FCT')).toBe('FCT Abuja');
    expect(tripDestinationOf('Oyo')).toBe('Oyo');
    expect(stateOfDestination('FCT Abuja')).toBe('FCT');
    expect(stateOfDestination('Lagos')).toBe('Lagos');
  });
});

describe('words', () => {
  it('say when and how far along a trip is', () => {
    expect(tripWhen(null, null)).toBeNull();
    expect(tripWhen('2026-12-18', '2026-12-22')).toBe('18–22 Dec');
    expect(progressLine(trip())).toBe('1 of 2 booked');
    expect(progressLine(trip({ services: [] }))).toBe('Nothing added yet');
    expect(progressLine(trip({ services: [{ id: 's1', type: 'hotel', status: 'booked' }] }))).toBe(
      'Booked',
    );
  });
});

describe('after a booking (the web’s cross-sell)', () => {
  it('suggests what travellers also need, by what was just booked', () => {
    expect(crossSell('hotel').map((s) => s.label)).toEqual(['Rent a car', 'Book events']);
    expect(crossSell('apartment').map((s) => s.label)).toEqual(['Rent a car', 'Add security']);
    expect(crossSell('event').map((s) => s.label)).toEqual(['Book a hotel', 'Rent a car']);
  });
  it('offers the newest trip still being planned, with something left to book', () => {
    const done = trip({ id: 'done', services: [{ id: 's1', type: 'hotel', status: 'booked' }] });
    expect(openTrip([done, trip({ id: 't2' }), trip({ id: 't3' })])?.id).toBe('t2');
    expect(openTrip([done])).toBeNull();
  });
});

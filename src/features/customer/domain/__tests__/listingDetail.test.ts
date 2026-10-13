import {
  apartmentFacts,
  bedsLine,
  earlyBirdNote,
  eventDateLine,
  eventDay,
  handoff,
  hotelFacts,
  hotelFromPrice,
  httpsImages,
  pricingRuleLine,
} from '@/features/customer/domain/listingDetail';
import type { ApartmentDetail, HotelDetail } from '@/features/customer/schemas/listings';

const NOW = Date.UTC(2026, 9, 13, 11, 0, 0); // Tue 13 Oct, 12:00 Lagos

describe('httpsImages', () => {
  it('keeps https URLs only, trimmed, without duplicates', () => {
    expect(
      httpsImages([
        ' https://a.test/1.jpg ',
        'http://a.test/2.jpg',
        'data:x',
        'https://a.test/1.jpg',
      ]),
    ).toEqual(['https://a.test/1.jpg']);
    expect(httpsImages(null)).toEqual([]);
  });
});

describe('hotelFromPrice', () => {
  it('is the lowest room-type from-price, or null when no room has one', () => {
    const types = [
      { id: 'a', base_price: 60000 },
      { id: 'b', base_price: 0 },
    ];
    const rates = [
      { room_type_id: 'a', price_per_night: 55000 },
      { room_type_id: 'b', price_per_night: 70000 },
    ];
    expect(hotelFromPrice(types, rates)).toBe(55000);
    expect(hotelFromPrice([{ id: 'c', base_price: null }], [])).toBeNull();
    expect(hotelFromPrice([], [])).toBeNull();
  });
});

describe('bedsLine', () => {
  it('reads beds as words', () => {
    expect(bedsLine([{ type: 'King', count: 1 }])).toBe('1 king bed');
    expect(
      bedsLine([
        { type: 'queen bed', count: 2 },
        { type: null, count: null },
      ]),
    ).toBe('2 queen beds, 1 bed');
    expect(bedsLine([])).toBeNull();
  });
});

describe('eventDateLine and eventDay', () => {
  it('shows one day with its 12-hour Lagos time', () => {
    const e = {
      event_date: '2026-10-17T00:00:00',
      event_end_date: null,
      event_time: '2026-10-17T18:00:00+00:00',
    };
    expect(eventDateLine(e)).toBe('Sat 17 Oct · 7:00 pm');
    expect(eventDay(e.event_date)).toBe('Sat 17 Oct');
  });

  it('shows a multi-day run and tolerates a bare time', () => {
    expect(
      eventDateLine({
        event_date: '2026-10-17',
        event_end_date: '2026-10-19',
        event_time: '19:30',
      }),
    ).toBe('Sat 17 Oct – Mon 19 Oct · 7:30 pm');
  });

  it('is null without a readable date', () => {
    expect(eventDateLine({ event_date: null, event_end_date: null, event_time: null })).toBeNull();
    expect(eventDay('soon')).toBeNull();
  });
});

describe('earlyBirdNote', () => {
  const pkg = { price: 10000, early_bird_price: 7000, early_bird_end: '2026-10-16T22:59:00Z' };
  it('names the Lagos day the early bird ends while it is on', () => {
    expect(earlyBirdNote(pkg, NOW)).toBe('Early bird until Fri 16 Oct');
  });
  it('is null once it has ended or without an early-bird price', () => {
    expect(earlyBirdNote({ ...pkg, early_bird_end: '2026-10-12T10:00:00Z' }, NOW)).toBeNull();
    expect(earlyBirdNote({ ...pkg, early_bird_price: null }, NOW)).toBeNull();
    expect(earlyBirdNote({ price: 10000 }, NOW)).toBeNull();
  });
});

describe('handoff', () => {
  it('stays hand off to the web', () => {
    expect(handoff('hotel', null)).toEqual({ label: 'Book on bookhushly.com', blocked: null });
    expect(handoff('apartment', null)).toEqual({ label: 'Book on bookhushly.com', blocked: null });
  });
  it('never offers tickets for sold-out, ended or not-on-sale events', () => {
    expect(handoff('event', 'soldOut').blocked).toBe('Sold out');
    expect(handoff('event', 'ended').blocked).toBe('This event has ended');
    expect(handoff('event', 'notOnSale').blocked).toBe('Not on sale');
  });
  it('offers tickets while on sale, including low stock', () => {
    for (const s of ['onSale', 'fewLeft', 'almostSoldOut'] as const)
      expect(handoff('event', s)).toEqual({
        label: 'Get tickets on bookhushly.com',
        blocked: null,
      });
  });
});

describe('pricingRuleLine', () => {
  it('reads a seasonal rule with its dates', () => {
    expect(
      pricingRuleLine({
        id: 'r',
        label: 'Christmas',
        start_date: '2026-12-20',
        end_date: '2027-01-02',
        price_per_night: 90000,
      }),
    ).toEqual({ id: 'r', label: 'Christmas · 20 Dec – 2 Jan', amount: 90000 });
  });
  it('falls back to the dates and drops rules without a price', () => {
    const r = { id: 'r', label: null, start_date: '2026-12-20', end_date: '2026-12-24' };
    expect(pricingRuleLine({ ...r, price_per_night: 80000 })?.label).toBe('20–24 Dec');
    expect(pricingRuleLine({ ...r, price_per_night: 0 })).toBeNull();
  });
});

const HOTEL: HotelDetail = {
  id: 'h1',
  name: 'Harbour Suites',
  description: null,
  address: null,
  city: null,
  state: null,
  image_urls: null,
  amenities: [],
  checkout_policy: null,
  policies: null,
  check_in_time: null,
  check_out_time: null,
  breakfast_offered: null,
  breakfast_type: null,
  generator_available: null,
  generator_hours: null,
  inverter_available: null,
  airport_transfer_enabled: null,
  avg_rating: null,
  review_count: null,
  nihotour_certified: null,
};

describe('hotelFacts', () => {
  it('reads breakfast, power and transfer the web way', () => {
    expect(
      hotelFacts({
        ...HOTEL,
        breakfast_offered: 'included',
        breakfast_type: 'continental',
        generator_available: '24hrs',
        inverter_available: 'true',
        airport_transfer_enabled: true,
      }),
    ).toEqual([
      'Breakfast included (continental)',
      '24-hour generator',
      'Inverter or solar backup',
      'Airport transfer available',
    ]);
    expect(
      hotelFacts({
        ...HOTEL,
        breakfast_offered: 'paid',
        generator_available: 'partial',
        generator_hours: '6 pm – 6 am',
      }),
    ).toEqual(['Breakfast at extra cost', 'Generator 6 pm – 6 am']);
  });
  it('says nothing for none or unknown values', () => {
    expect(
      hotelFacts({ ...HOTEL, breakfast_offered: 'none', inverter_available: 'false' }),
    ).toEqual([]);
  });
});

const APT: ApartmentDetail = {
  id: 'a1',
  name: 'Lekki Loft',
  description: null,
  address: null,
  city: null,
  state: null,
  area: null,
  landmark: null,
  image_urls: null,
  amenities: [],
  apartment_type: null,
  bedrooms: null,
  bathrooms: null,
  max_guests: null,
  square_meters: null,
  price_per_night: null,
  price_per_week: null,
  price_per_month: null,
  minimum_stay: null,
  furnished: null,
  kitchen_equipped: null,
  parking_spaces: null,
  utilities_included: null,
  electricity_included: null,
  generator_available: null,
  generator_hours: null,
  inverter_available: null,
  solar_power: null,
  water_supply: null,
  internet_included: null,
  security_features: [],
  check_in_time: null,
  check_out_time: null,
  cancellation_policy: null,
  house_rules: null,
  caution_deposit: null,
  status: 'active',
  avg_rating: null,
  review_count: null,
};

describe('apartmentFacts', () => {
  it('lists only what is known', () => {
    expect(apartmentFacts(APT)).toEqual([]);
    expect(
      apartmentFacts({
        ...APT,
        apartment_type: 'two_bedroom',
        bedrooms: 2,
        bathrooms: 1,
        max_guests: 4,
        square_meters: 85,
        furnished: true,
        kitchen_equipped: true,
        parking_spaces: 1,
        electricity_included: true,
        generator_available: true,
        generator_hours: '24 hours',
        solar_power: true,
        water_supply: 'borehole',
        internet_included: true,
      }),
    ).toEqual([
      { label: 'Type', value: 'Two bedroom' },
      { label: 'Bedrooms', value: '2' },
      { label: 'Bathrooms', value: '1' },
      { label: 'Guests', value: 'Up to 4' },
      { label: 'Size', value: '85 m²' },
      { label: 'Furnished', value: 'Yes' },
      { label: 'Kitchen', value: 'Equipped' },
      { label: 'Parking', value: '1 space' },
      { label: 'Power', value: 'Electricity included, generator (24 hours), solar' },
      { label: 'Water', value: 'Borehole' },
      { label: 'Internet', value: 'Included' },
    ]);
  });
  it('says Not furnished when the row says so', () => {
    expect(apartmentFacts({ ...APT, furnished: false })).toEqual([
      { label: 'Furnished', value: 'No' },
    ]);
  });
});

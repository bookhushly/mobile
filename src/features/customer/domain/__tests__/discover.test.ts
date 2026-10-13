import {
  apartmentPriceLabel,
  buildListingParams,
  effectivePackagePrice,
  eventPriceLabel,
  eventStock,
  filterCount,
  hotelPriceLabel,
  afterThisWeekend,
  inThisWeekend,
  knownPlace,
  normalizeAmenities,
  packageStock,
  placeForState,
  POPULAR_PLACES,
  ratingLabel,
  roomTypeFrom,
  sanitizeSearch,
  webListingUrl,
  type Filters,
  type StockEvent,
} from '@/features/customer/domain/discover';

const TODAY = '2026-10-13'; // a Tuesday
const NOW = Date.UTC(2026, 9, 13, 11, 0, 0); // 12:00 Lagos
const NEWEST: Filters = { sort: 'newest' };
const where = { q: '', page: 0 };

describe('sanitizeSearch', () => {
  it('strips commas and brackets so the route never sees them', () => {
    expect(sanitizeSearch('Lagos, Lekki (Phase 1)')).toBe('Lagos Lekki Phase 1');
  });

  it.each([',', '(', ')', '%', '*', '\\', '"', "'", '‘', '’', '“', '”'])('removes %s', (ch) => {
    expect(sanitizeSearch(`Ik${ch}eja`)).toBe('Ikeja');
  });

  it('trims and collapses inner whitespace', () => {
    expect(sanitizeSearch('  Victoria \t  Island \n ')).toBe('Victoria Island');
  });

  it('caps at 60 characters with no trailing space', () => {
    const out = sanitizeSearch(`${'a'.repeat(59)} bbbbb`);
    expect(out).toBe('a'.repeat(59));
    expect(sanitizeSearch('x'.repeat(100))).toHaveLength(60);
  });

  it('caps by code points: an emoji at the limit is kept whole or dropped, never split', () => {
    const at60 = sanitizeSearch(`${'a'.repeat(59)}😀😀`);
    expect(at60).toBe(`${'a'.repeat(59)}😀`);
    expect(Array.from(at60)).toHaveLength(60);
    for (let n = 55; n <= 62; n += 1) {
      const out = sanitizeSearch(`${'b'.repeat(n)}😀🏳️‍🌈x`);
      expect(() => encodeURIComponent(out)).not.toThrow();
    }
  });

  it("keeps '' as ''", () => {
    expect(sanitizeSearch('')).toBe('');
    expect(sanitizeSearch(' ,() ')).toBe('');
  });
});

describe('buildListingParams', () => {
  it('sends sort and page; search only when non-empty and always sanitised', () => {
    expect(buildListingParams('hotels', { q: '  ', page: 2 }, NEWEST, TODAY)).toEqual({
      params: { sort: 'newest', page: '2' },
    });
    expect(
      buildListingParams('hotels', { q: 'Lagos, Lekki (Phase 1)', page: 0 }, NEWEST, TODAY).params,
    ).toEqual({ sort: 'newest', page: '0', search: 'Lagos Lekki Phase 1' });
  });

  it('sanitises state and city and drops them when empty', () => {
    expect(
      buildListingParams(
        'events',
        { q: '', page: 0, state: 'Lagos)', city: 'Port, Harcourt' },
        NEWEST,
        TODAY,
      ).params,
    ).toEqual({ sort: 'newest', page: '0', state: 'Lagos', city: 'Port Harcourt' });
    expect(buildListingParams('events', { ...where, state: ' ( ' }, NEWEST, TODAY).params).toEqual({
      sort: 'newest',
      page: '0',
    });
  });

  it('Abuja (state FCT) for events sends city=Abuja; stays keep state=FCT (K3)', () => {
    const abuja = { q: '', page: 0, state: 'FCT' };
    // Events match the place on `location` text, which reads "Abuja", rarely "FCT".
    expect(buildListingParams('events', abuja, NEWEST, TODAY).params).toEqual({
      sort: 'newest',
      page: '0',
      city: 'Abuja',
    });
    expect(buildListingParams('hotels', abuja, NEWEST, TODAY).params).toEqual({
      sort: 'newest',
      page: '0',
      state: 'FCT',
    });
    expect(buildListingParams('serviced_apartments', abuja, NEWEST, TODAY).params.state).toBe(
      'FCT',
    );
    // A city already chosen wins.
    expect(
      buildListingParams('events', { ...abuja, city: 'Gwarinpa' }, NEWEST, TODAY).params,
    ).toMatchObject({ city: 'Gwarinpa', state: 'FCT' });
  });

  it('maps price to positive whole naira and ignores zero or negative', () => {
    expect(
      buildListingParams(
        'serviced_apartments',
        where,
        { sort: 'price_asc', priceMin: 10000.7, priceMax: 50000 },
        TODAY,
      ).params,
    ).toEqual({ sort: 'price_asc', page: '0', price_min: '10000', price_max: '50000' });
    expect(
      buildListingParams('hotels', where, { sort: 'newest', priceMin: 0, priceMax: -5 }, TODAY)
        .params,
    ).toEqual({ sort: 'newest', page: '0' });
  });

  it('maps hotel filters', () => {
    expect(
      buildListingParams(
        'hotels',
        where,
        { sort: 'top_rated', minRating: 4.5, breakfastIncluded: true, generator24h: true },
        TODAY,
      ).params,
    ).toEqual({
      sort: 'top_rated',
      page: '0',
      min_rating: '4.5',
      breakfast_offered: 'included',
      hotel_has_generator: 'true',
    });
  });

  it('maps apartment filters and ignores rating for non-hotels', () => {
    expect(
      buildListingParams(
        'serviced_apartments',
        where,
        { sort: 'newest', bedrooms: 2, furnished: true, generator: true, minRating: 4 },
        TODAY,
      ).params,
    ).toEqual({
      sort: 'newest',
      page: '0',
      bedrooms: '2',
      furnished: 'true',
      generator_available: 'true',
    });
    expect(
      buildListingParams('events', where, { sort: 'newest', minRating: 4 }, TODAY).params,
    ).toEqual({ sort: 'newest', page: '0' });
  });

  it('ignores filters that belong to another category', () => {
    expect(
      buildListingParams(
        'hotels',
        where,
        { sort: 'newest', bedrooms: 3, furnished: true, generator: true, eventDate: 'today' },
        TODAY,
      ).params,
    ).toEqual({ sort: 'newest', page: '0' });
  });

  it('maps event dates: today is the Lagos date, a picked date passes, weekend filters on device', () => {
    expect(
      buildListingParams('events', where, { sort: 'newest', eventDate: 'today' }, TODAY),
    ).toEqual({ params: { sort: 'newest', page: '0', event_date: TODAY } });
    expect(
      buildListingParams('events', where, { sort: 'newest', eventDate: '2026-10-20' }, TODAY),
    ).toEqual({ params: { sort: 'newest', page: '0', event_date: '2026-10-20' } });
    expect(
      buildListingParams('events', where, { sort: 'newest', eventDate: 'weekend' }, TODAY),
    ).toEqual({ params: { sort: 'newest', page: '0' }, clientFilter: 'weekend' });
  });

  it('drops a picked date that is not a calendar date', () => {
    expect(
      buildListingParams('events', where, { sort: 'newest', eventDate: '2026-02-30' }, TODAY)
        .params,
    ).toEqual({ sort: 'newest', page: '0' });
  });

  it('never emits the hotel filters that return nothing (bed_sizes, floor, avail_*)', () => {
    const everything: Filters = {
      sort: 'price_desc',
      priceMin: 1,
      priceMax: 2,
      minRating: 3,
      breakfastIncluded: true,
      generator24h: true,
      bedrooms: 1,
      furnished: true,
      generator: true,
      eventDate: '2026-10-20',
    };
    for (const cat of ['hotels', 'serviced_apartments', 'events'] as const) {
      const keys = Object.keys(buildListingParams(cat, where, everything, TODAY).params);
      for (const banned of ['bed_sizes', 'floor', 'avail_checkin', 'avail_checkout']) {
        expect(keys).not.toContain(banned);
      }
    }
  });
});

describe('inThisWeekend', () => {
  it('keeps Friday to Sunday of this week (Lagos dates)', () => {
    expect(inThisWeekend('2026-10-16T19:00:00', TODAY)).toBe(true); // Fri
    expect(inThisWeekend('2026-10-18', TODAY)).toBe(true); // Sun
    expect(inThisWeekend('2026-10-15T23:00:00', TODAY)).toBe(false); // Thu
    expect(inThisWeekend('2026-10-19', TODAY)).toBe(false); // next Mon
    expect(inThisWeekend(null, TODAY)).toBe(false);
  });

  it('afterThisWeekend: only dates after this Sunday', () => {
    expect(afterThisWeekend('2026-10-19T00:00:00', TODAY)).toBe(true); // next Mon
    expect(afterThisWeekend('2026-10-18', TODAY)).toBe(false); // Sun
    expect(afterThisWeekend('2026-10-14', TODAY)).toBe(false);
    expect(afterThisWeekend(null, TODAY)).toBe(false);
    expect(afterThisWeekend('soon', TODAY)).toBe(false);
  });

  it('on a Sunday, this weekend is the one ending today', () => {
    expect(inThisWeekend('2026-10-18', '2026-10-18')).toBe(true);
    expect(inThisWeekend('2026-10-23', '2026-10-18')).toBe(false);
  });
});

describe('filterCount', () => {
  it('is 0 for the defaults', () => {
    expect(filterCount('hotels', NEWEST)).toBe(0);
  });

  it('never counts the sort (the Sort chip shows it, and a sort never empties a list)', () => {
    expect(filterCount('hotels', { sort: 'price_desc' })).toBe(0);
  });

  it('counts the price range once and the category’s own filters', () => {
    expect(
      filterCount('hotels', {
        sort: 'price_asc',
        priceMin: 1000,
        priceMax: 5000,
        minRating: 4,
        breakfastIncluded: true,
        generator24h: false,
        bedrooms: 2,
      }),
    ).toBe(3);
    expect(
      filterCount('serviced_apartments', {
        sort: 'newest',
        bedrooms: 1,
        furnished: true,
        generator: true,
      }),
    ).toBe(3);
    expect(filterCount('events', { sort: 'top_rated', eventDate: 'weekend', minRating: 4 })).toBe(
      1,
    );
  });
});

describe('POPULAR_PLACES', () => {
  it('maps each place to a state or a city', () => {
    expect(POPULAR_PLACES).toEqual([
      { label: 'Lagos', state: 'Lagos' },
      { label: 'Abuja', state: 'FCT' },
      { label: 'Port Harcourt', city: 'Port Harcourt' },
      { label: 'Ibadan', city: 'Ibadan' },
      { label: 'Enugu', state: 'Enugu' },
      { label: 'Kano', state: 'Kano' },
      { label: 'Uyo', city: 'Uyo' },
      { label: 'Calabar', city: 'Calabar' },
    ]);
  });
});

describe('placeForState', () => {
  it('maps a profile state to its popular place, else the state itself, else Lagos', () => {
    expect(placeForState('Lagos')).toEqual({ label: 'Lagos', state: 'Lagos' });
    expect(placeForState('FCT')).toEqual({ label: 'Abuja', state: 'FCT' });
    expect(placeForState('Oyo')).toEqual({ label: 'Oyo', state: 'Oyo' });
    expect(placeForState(' Rivers ')).toEqual({ label: 'Rivers', state: 'Rivers' });
  });

  it.each([null, '', 'Atlantis', 'lagos'])('%p falls back to Lagos', (s) => {
    expect(placeForState(s)).toEqual({ label: 'Lagos', state: 'Lagos' });
  });
});

describe('knownPlace', () => {
  it('accepts a popular place or a Nigerian state, as stored', () => {
    expect(knownPlace({ label: 'Port Harcourt', city: 'Port Harcourt' })).toEqual({
      label: 'Port Harcourt',
      city: 'Port Harcourt',
    });
    expect(knownPlace({ label: 'Ogun', state: 'Ogun' })).toEqual({ label: 'Ogun', state: 'Ogun' });
    expect(knownPlace({ label: 'Abuja', state: 'FCT' })).toEqual({ label: 'Abuja', state: 'FCT' });
  });

  it.each<unknown>([
    null,
    'Lagos',
    { label: 'Lagos' },
    { label: 'Mars', state: 'Mars' },
    { label: 'Ikeja', city: 'Ikeja' },
    { label: 'Lagos', state: 'Lagos', city: 'Ikeja' },
    { label: 'Hacked', state: 'Lagos' },
  ])('rejects %p', (v) => {
    expect(knownPlace(v)).toBeNull();
  });
});

describe('prices', () => {
  it('a hotel at 0 never shows ₦0', () => {
    expect(hotelPriceLabel(45000)).toEqual({ amount: 45000, unit: 'night', prefix: 'From' });
    expect(hotelPriceLabel(0)).toEqual({ text: 'See rooms for prices' });
    expect(hotelPriceLabel(null)).toEqual({ text: 'See rooms for prices' });
  });

  it('room type from-price is the lowest positive rate or base price', () => {
    const rates = [
      { room_type_id: 'rt1', price_per_night: 30000 },
      { room_type_id: 'rt1', price_per_night: 0 },
      { room_type_id: 'rt2', price_per_night: 10000 },
    ];
    expect(roomTypeFrom({ id: 'rt1', base_price: 35000 }, rates)).toBe(30000);
    expect(roomTypeFrom({ id: 'rt1', base_price: 25000 }, rates)).toBe(25000);
    expect(roomTypeFrom({ id: 'rt3', base_price: 0 }, rates)).toBeNull();
    expect(roomTypeFrom({ id: 'rt3', base_price: null }, [])).toBeNull();
  });

  it('apartment: nightly price, week and month when set, and whether rules vary it', () => {
    const apt = { price_per_night: 50000, price_per_week: null, price_per_month: 1200000 };
    expect(apartmentPriceLabel(apt, [])).toEqual({
      amount: 50000,
      unit: 'night',
      month: 1200000,
      varies: false,
    });
    expect(apartmentPriceLabel({ ...apt, price_per_week: 300000 }, [{ id: 'r1' }])).toEqual({
      amount: 50000,
      unit: 'night',
      week: 300000,
      month: 1200000,
      varies: true,
    });
  });

  it('apartment without a nightly price never shows ₦0', () => {
    expect(
      apartmentPriceLabel({ price_per_night: 0, price_per_week: null, price_per_month: null }, []),
    ).toEqual({ text: 'See prices on bookhushly.com' });
  });

  it('early bird applies only while its end is in the future', () => {
    const pkg = {
      name: 'Regular',
      price: 10000,
      early_bird_price: 7000,
      early_bird_end: '2026-10-14T00:00:00Z',
    };
    expect(effectivePackagePrice(pkg, NOW)).toBe(7000);
    expect(effectivePackagePrice({ ...pkg, early_bird_end: '2026-10-12T00:00:00Z' }, NOW)).toBe(
      10000,
    );
    expect(effectivePackagePrice({ ...pkg, early_bird_end: null }, NOW)).toBe(10000);
    expect(effectivePackagePrice({ ...pkg, early_bird_price: null }, NOW)).toBe(10000);
  });

  it('event: From the lowest effective package price', () => {
    expect(
      eventPriceLabel(
        {
          price: 5000,
          ticket_packages: [
            { name: 'VIP', price: 50000 },
            {
              name: 'Regular',
              price: 10000,
              early_bird_price: 8000,
              early_bird_end: '2026-10-20T00:00:00Z',
            },
          ],
        },
        NOW,
      ),
    ).toEqual({ amount: 8000, prefix: 'From' });
  });

  it('event: a single tier has no From', () => {
    expect(
      eventPriceLabel({ price: null, ticket_packages: [{ name: 'GA', price: 15000 }] }, NOW),
    ).toEqual({ amount: 15000 });
  });

  it('event: Free only when every tier is 0; a 0 minimum with a paid tier is a range (as the web)', () => {
    expect(
      eventPriceLabel(
        {
          price: 1,
          ticket_packages: [
            { name: 'Free', price: 0 },
            { name: 'VIP', price: 5000 },
          ],
        },
        NOW,
      ),
    ).toEqual({ min: 0, max: 5000 });
    expect(
      eventPriceLabel(
        {
          price: 5000,
          ticket_packages: [
            { name: 'A', price: 0 },
            { name: 'B', price: 0 },
          ],
        },
        NOW,
      ),
    ).toEqual({ text: 'Free' });
  });

  it('event without packages: the price, 0 is Free, null is no label', () => {
    expect(eventPriceLabel({ price: 2500, ticket_packages: [] }, NOW)).toEqual({ amount: 2500 });
    expect(eventPriceLabel({ price: 0, ticket_packages: [] }, NOW)).toEqual({ text: 'Free' });
    expect(eventPriceLabel({ price: null, ticket_packages: [] }, NOW)).toBeNull();
  });
});

describe('eventStock', () => {
  const base: StockEvent = {
    event_date: '2026-10-18T00:00:00',
    event_end_date: null,
    active: true,
    availability: 'available',
    ticket_packages: [],
    remaining_tickets: 500,
    total_tickets: 500,
    low_stock_threshold: null,
  };

  it('ended: the end day (or the start day) is before today in Lagos', () => {
    expect(eventStock({ ...base, event_date: '2026-10-12T20:00:00' }, NOW, TODAY)).toBe('ended');
    expect(
      eventStock(
        { ...base, event_date: '2026-10-10T20:00:00', event_end_date: '2026-10-13' },
        NOW,
        TODAY,
      ),
    ).toBe('onSale');
    expect(eventStock({ ...base, event_date: '2026-10-13T08:00:00' }, NOW, TODAY)).toBe('onSale');
  });

  it('defaults today from now', () => {
    expect(eventStock({ ...base, event_date: '2026-10-12T20:00:00' }, NOW)).toBe('ended');
  });

  it('not on sale when inactive or not available', () => {
    expect(eventStock({ ...base, active: false }, NOW, TODAY)).toBe('notOnSale');
    expect(eventStock({ ...base, availability: 'unavailable' }, NOW, TODAY)).toBe('notOnSale');
    expect(eventStock({ ...base, availability: null }, NOW, TODAY)).toBe('notOnSale');
  });

  it('sold out: every package at 0, or no packages and 0 of a positive total', () => {
    expect(
      eventStock(
        {
          ...base,
          ticket_packages: [
            { name: 'A', price: 1, total: 10, remaining: 0 },
            { name: 'B', price: 2, total: 5, remaining: 0 },
          ],
        },
        NOW,
        TODAY,
      ),
    ).toBe('soldOut');
    expect(eventStock({ ...base, remaining_tickets: 0, total_tickets: 100 }, NOW, TODAY)).toBe(
      'soldOut',
    );
    expect(eventStock({ ...base, remaining_tickets: 0, total_tickets: 0 }, NOW, TODAY)).toBe(
      'onSale',
    );
  });

  it('a package with no remaining count is treated as 0, as the web does', () => {
    expect(eventStock({ ...base, ticket_packages: [{ name: 'A', price: 1 }] }, NOW, TODAY)).toBe(
      'soldOut',
    );
  });

  it('low stock follows the web: ≤ 30% of the threshold is almost sold out, ≤ threshold is few left', () => {
    // threshold 50 → almost ≤ 15, few ≤ 50
    expect(eventStock({ ...base, remaining_tickets: 15 }, NOW, TODAY)).toBe('almostSoldOut');
    expect(eventStock({ ...base, remaining_tickets: 16 }, NOW, TODAY)).toBe('fewLeft');
    expect(eventStock({ ...base, remaining_tickets: 50 }, NOW, TODAY)).toBe('fewLeft');
    expect(eventStock({ ...base, remaining_tickets: 51 }, NOW, TODAY)).toBe('onSale');
    // custom threshold 10 → almost ≤ 3
    // Text through the `->>` JSON path, or a number from the route.
    const cd = '10';
    expect(eventStock({ ...base, remaining_tickets: 3, low_stock_threshold: cd }, NOW, TODAY)).toBe(
      'almostSoldOut',
    );
    expect(
      eventStock({ ...base, remaining_tickets: 11, low_stock_threshold: 10 }, NOW, TODAY),
    ).toBe('onSale');
  });

  it('packages: low stock counts the tickets left across tiers', () => {
    expect(
      eventStock(
        {
          ...base,
          ticket_packages: [
            { name: 'A', price: 1, total: 100, remaining: 0 },
            { name: 'B', price: 2, total: 100, remaining: 12 },
          ],
        },
        NOW,
        TODAY,
      ),
    ).toBe('almostSoldOut');
  });

  it('per package', () => {
    expect(packageStock({ name: 'A', price: 1, remaining: 0 })).toBe('soldOut');
    expect(packageStock({ name: 'A', price: 1, remaining: 30 })).toBe('fewLeft');
    expect(packageStock({ name: 'A', price: 1, remaining: 300 })).toBe('onSale');
    expect(packageStock({ name: 'A', price: 1, remaining: 30 }, 20)).toBe('onSale');
  });
});

describe('ratingLabel', () => {
  it('one decimal with the count, only when there are reviews', () => {
    expect(ratingLabel(4.6, 23)).toBe('4.6 (23)');
    expect(ratingLabel(4, 1)).toBe('4.0 (1)');
    expect(ratingLabel(4.6, 0)).toBeNull();
    expect(ratingLabel(null, 5)).toBeNull();
    expect(ratingLabel(0, 5)).toBeNull();
    expect(ratingLabel(4.2, null)).toBeNull();
  });
});

describe('webListingUrl', () => {
  it('per kind, on the apex domain, with encoded ids', () => {
    expect(webListingUrl('hotel', 'h1')).toBe('https://bookhushly.com/services/hotels/h1');
    expect(webListingUrl('apartment', 'a1')).toBe(
      'https://bookhushly.com/services/serviced-apartments/a1',
    );
    expect(webListingUrl('event', 'e/1?x')).toBe('https://bookhushly.com/services/e%2F1%3Fx');
  });
});

describe('normalizeAmenities', () => {
  it('reads {items: []}', () => {
    expect(normalizeAmenities({ items: ['Pool', 'Gym', 3] })).toEqual(['Pool', 'Gym']);
  });

  it('reads a string array', () => {
    expect(normalizeAmenities([' Wi-Fi ', '', 'Parking'])).toEqual(['Wi-Fi', 'Parking']);
  });

  it('reads {key: true} as sentence-case labels', () => {
    expect(normalizeAmenities({ free_wifi: true, swimming_pool: false, gym: true })).toEqual([
      'Free wifi',
      'Gym',
    ]);
  });

  it('anything else is []', () => {
    expect(normalizeAmenities(null)).toEqual([]);
    expect(normalizeAmenities('pool')).toEqual([]);
    expect(normalizeAmenities(42)).toEqual([]);
  });
});

import {
  APARTMENT_COLUMNS,
  apartmentDetail,
  apartmentItem,
  EVENT_COLUMNS,
  eventDetail,
  eventItem,
  HOTEL_COLUMNS,
  hotelDetail,
  hotelItem,
  listingsPage,
  PRICING_RULE_COLUMNS,
  pricingRule,
  ROOM_RATE_COLUMNS,
  ROOM_TYPE_COLUMNS,
  roomRate,
  roomType,
} from '@/features/customer/schemas/listings';

const FORBIDDEN = [
  'phone',
  'caretaker',
  'agent',
  'whatsapp',
  'custom_questions',
  'seats_config',
  'views_count',
  'security_deposit_notes',
];
const COLUMNS = {
  HOTEL_COLUMNS,
  ROOM_TYPE_COLUMNS,
  ROOM_RATE_COLUMNS,
  APARTMENT_COLUMNS,
  PRICING_RULE_COLUMNS,
  EVENT_COLUMNS,
};

describe('detail column constants', () => {
  it.each(Object.entries(COLUMNS))('%s never names a private field', (_name, cols) => {
    for (const word of FORBIDDEN) expect(cols).not.toContain(word);
    expect(cols).not.toContain('*');
  });

  it('are the exact explicit lists', () => {
    expect(HOTEL_COLUMNS).toBe(
      'id, name, description, address, city, state, image_urls, amenities, checkout_policy, policies, check_in_time, check_out_time, breakfast_offered, breakfast_type, generator_available, generator_hours, inverter_available, airport_transfer_enabled, avg_rating, review_count, nihotour_certified',
    );
    expect(ROOM_TYPE_COLUMNS).toBe(
      'id, hotel_id, name, description, max_occupancy, base_price, size_sqm, amenities, image_urls',
    );
    expect(ROOM_RATE_COLUMNS).toBe('id, room_type_id, beds, price_per_night, is_default, label');
    expect(APARTMENT_COLUMNS).toBe(
      'id, name, description, address, city, state, area, landmark, image_urls, amenities, apartment_type, bedrooms, bathrooms, max_guests, square_meters, price_per_night, price_per_week, price_per_month, minimum_stay, furnished, kitchen_equipped, parking_spaces, utilities_included, electricity_included, generator_available, generator_hours, inverter_available, solar_power, water_supply, internet_included, security_features, check_in_time, check_out_time, cancellation_policy, house_rules, caution_deposit, status, avg_rating, review_count',
    );
    expect(PRICING_RULE_COLUMNS).toBe('id, label, start_date, end_date, price_per_night');
    expect(EVENT_COLUMNS).toBe(
      'id, title, description, price, price_unit, location, media_urls, active, availability, vendor_name, event_date, event_time, event_end_date, total_tickets, remaining_tickets, ticket_packages, low_stock_threshold:category_data->>low_stock_threshold, cancellation_policy',
    );
  });
});

describe('list items', () => {
  it('a hotel item keeps only what we use (agent fields stripped)', () => {
    const p = hotelItem.parse({
      id: 'h1',
      title: 'Eko Hotel',
      location: 'Lagos, Lagos',
      price: 0,
      media_urls: ['https://x/1.jpg'],
      city: 'Lagos',
      state: 'Lagos',
      avg_rating: 4.5,
      review_count: 10,
      breakfast_offered: 'included',
      generator_available: '24h',
      agent_phone: '0800',
      vendor_id: 'v1',
    });
    expect(p).toEqual({
      id: 'h1',
      title: 'Eko Hotel',
      location: 'Lagos, Lagos',
      price: 0,
      media_urls: ['https://x/1.jpg'],
      city: 'Lagos',
      state: 'Lagos',
      avg_rating: 4.5,
      review_count: 10,
      breakfast_offered: 'included',
      generator_available: '24h',
    });
  });

  it('tolerates missing optional fields and numeric strings', () => {
    expect(hotelItem.parse({ id: 'h1', price: '12000.50' })).toEqual({
      id: 'h1',
      title: null,
      location: null,
      price: 12000.5,
      media_urls: null,
      city: null,
      state: null,
      avg_rating: null,
      review_count: null,
      breakfast_offered: null,
      generator_available: null,
    });
  });

  it('an apartment item strips agent_phone', () => {
    const p = apartmentItem.parse({
      id: 'a1',
      title: 'Lekki 2-bed',
      price: 50000,
      bedrooms: 2,
      bathrooms: 2.5,
      furnished: true,
      agent_phone: '0800',
      agent_name: 'X',
    });
    expect(p).not.toHaveProperty('agent_phone');
    expect(p).not.toHaveProperty('agent_name');
    expect(p.bathrooms).toBe(2.5);
    expect(p.furnished).toBe(true);
  });

  it('an event item has a nullable price and keeps only the low-stock threshold (S1)', () => {
    const p = eventItem.parse({
      id: 'e1',
      title: 'Afrobeats',
      price: null,
      vendor_name: 'Org',
      event_date: '2026-10-18T00:00:00',
      category_data: { low_stock_threshold: 10, stream_url: 'https://meet.example/secret' },
      vendor_phone: '0800',
    });
    expect(p.price).toBeNull();
    expect(p).not.toHaveProperty('vendor_phone');
    expect(p).not.toHaveProperty('category_data');
    expect(JSON.stringify(p)).not.toContain('secret');
    expect(p.low_stock_threshold).toBe(10);
    expect(eventItem.parse({ id: 'e2', category_data: null }).low_stock_threshold).toBeNull();
    expect(eventItem.parse({ id: 'e3' }).low_stock_threshold).toBeNull();
    expect(
      eventItem.parse({ id: 'e4', category_data: { low_stock_threshold: { x: 1 } } })
        .low_stock_threshold,
    ).toBeNull();
  });

  it('a page: nextPage absent at the end, totalCount null after a post-filter; a bad row is dropped', () => {
    const page = listingsPage(hotelItem).parse({
      items: [{ id: 'h1', price: 1 }, { title: 'no id' }],
      totalCount: null,
    });
    expect(page.items.map((i) => i.id)).toEqual(['h1']);
    expect(page.nextPage).toBeUndefined();
    expect(page.totalCount).toBeNull();
    expect(listingsPage(eventItem).parse({ items: [], nextPage: 1, totalCount: 40 })).toEqual({
      items: [],
      nextPage: 1,
      totalCount: 40,
    });
    expect(listingsPage(eventItem).safeParse({ nextPage: 1 }).success).toBe(false);
  });
});

describe('detail rows', () => {
  it('a hotel normalises amenities', () => {
    const h = hotelDetail.parse({ id: 'h1', name: 'Eko', amenities: { items: ['Pool'] } });
    expect(h.amenities).toEqual(['Pool']);
    expect(h.image_urls).toBeNull();
    expect(h.nihotour_certified).toBeNull();
  });

  it('room types and rates', () => {
    expect(
      roomType.parse({ id: 'rt1', hotel_id: 'h1', name: 'Deluxe', base_price: '40000' }),
    ).toMatchObject({ base_price: 40000, amenities: [], max_occupancy: null });
    const r = roomRate.parse({
      id: 'r1',
      room_type_id: 'rt1',
      beds: { type: 'King', count: 1 },
      price_per_night: 38000,
      is_default: true,
      label: null,
    });
    expect(r.beds).toEqual([{ type: 'King', count: 1 }]);
    expect(roomRate.parse({ id: 'r2', room_type_id: 'rt1', beds: 'odd' }).beds).toEqual([]);
  });

  it('an apartment and its pricing rules', () => {
    const a = apartmentDetail.parse({
      id: 'a1',
      name: 'Lekki',
      amenities: { wifi: true, gym: false },
      security_features: ['CCTV'],
      price_per_night: 50000,
      status: 'active',
      caretaker_phone: '0800',
    });
    expect(a.amenities).toEqual(['Wifi']);
    expect(a.security_features).toEqual(['CCTV']);
    expect(a).not.toHaveProperty('caretaker_phone');
    expect(
      pricingRule.parse({
        id: 'p1',
        label: 'December',
        start_date: '2026-12-01',
        end_date: '2026-12-31',
        price_per_night: 80000,
      }),
    ).toEqual({
      id: 'p1',
      label: 'December',
      start_date: '2026-12-01',
      end_date: '2026-12-31',
      price_per_night: 80000,
    });
  });

  it('an event parses ticket packages and falls back to [] on a bad shape', () => {
    const e = eventDetail.parse({
      id: 'e1',
      title: 'Show',
      active: true,
      availability: 'available',
      ticket_packages: [
        {
          name: 'Regular',
          price: 10000,
          total: 100,
          remaining: '40',
          early_bird_price: 8000,
          early_bird_end: '2026-10-20T00:00:00Z',
          max_per_order: 4,
          secret: 'x',
        },
      ],
      vendor_phone: '0800',
      custom_questions: [{ q: 'x' }],
    });
    expect(e.ticket_packages).toEqual([
      {
        name: 'Regular',
        price: 10000,
        total: 100,
        remaining: 40,
        early_bird_price: 8000,
        early_bird_end: '2026-10-20T00:00:00Z',
        max_per_order: 4,
      },
    ]);
    expect(e).not.toHaveProperty('vendor_phone');
    expect(e).not.toHaveProperty('custom_questions');
    expect(e.low_stock_threshold).toBeNull();
    expect(eventDetail.parse({ id: 'e1', low_stock_threshold: '20' }).low_stock_threshold).toBe(
      '20',
    );
    expect(eventDetail.parse({ id: 'e1', ticket_packages: 'nope' }).ticket_packages).toEqual([]);
    expect(eventDetail.parse({ id: 'e1', ticket_packages: null }).ticket_packages).toEqual([]);
    expect(
      eventDetail.parse({ id: 'e1', ticket_packages: [{ price: 1 }] }).ticket_packages,
    ).toEqual([]);
    expect(eventDetail.parse({ id: 'e1', ticket_packages: { name: 'A' } }).ticket_packages).toEqual(
      [],
    );
  });

  it('a malformed tier (e.g. the web editor’s NaN price saved as null) drops only that tier', () => {
    const e = eventDetail.parse({
      id: 'e1',
      ticket_packages: [
        { name: 'Regular', price: null, remaining: 10 },
        { name: 'VIP', price: 50000, total: 20, remaining: 0 },
        'junk',
      ],
    });
    expect(e.ticket_packages).toEqual([{ name: 'VIP', price: 50000, total: 20, remaining: 0 }]);
  });
});

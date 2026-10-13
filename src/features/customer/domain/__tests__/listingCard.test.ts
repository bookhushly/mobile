import {
  cardOf,
  eventWhenLabel,
  firstHttpsImage,
  placeLine,
} from '@/features/customer/domain/listingCard';
import type { ApartmentItem, EventItem, HotelItem } from '@/features/customer/schemas/listings';

const NOW = Date.UTC(2026, 9, 13, 11, 0, 0);

const hotel = (p: Partial<HotelItem> = {}): HotelItem => ({
  id: 'h1',
  title: 'Harbour Suites',
  location: 'Ikeja, Lagos',
  price: 45000,
  media_urls: ['https://cdn.test/h1.jpg'],
  city: 'Ikeja',
  state: 'Lagos',
  avg_rating: 4.6,
  review_count: 23,
  breakfast_offered: null,
  generator_available: null,
  ...p,
});
const apartment = (p: Partial<ApartmentItem> = {}): ApartmentItem => ({
  id: 'a1',
  title: 'Lekki loft',
  location: 'Lekki',
  price: 30000,
  media_urls: null,
  city: 'Lagos',
  state: 'Lagos',
  area: 'Lekki',
  apartment_type: null,
  bedrooms: 2,
  bathrooms: 2,
  max_guests: 4,
  minimum_stay: 1,
  avg_rating: null,
  review_count: 0,
  furnished: true,
  ...p,
});
const event = (p: Partial<EventItem> = {}): EventItem => ({
  id: 'e1',
  title: 'Afrobeats night',
  location: 'Eko Hotel, Lagos',
  price: 5000,
  media_urls: ['http://insecure.test/e.jpg', 'https://cdn.test/e.jpg'],
  vendor_name: null,
  event_date: '2026-10-17T00:00:00',
  event_time: '2026-10-17T18:00:00+00:00',
  low_stock_threshold: null,
  ...p,
});

describe('firstHttpsImage', () => {
  it('takes the first https URL only', () => {
    expect(
      firstHttpsImage(['http://a.test/x.jpg', 'data:image/png;base64,AA', 'https://b.test/y.jpg']),
    ).toBe('https://b.test/y.jpg');
    expect(firstHttpsImage(['http://a.test/x.jpg'])).toBeNull();
    expect(firstHttpsImage(null)).toBeNull();
  });
});

describe('placeLine', () => {
  it('joins distinct non-empty parts', () => {
    expect(placeLine(['Lekki', ' lagos ', 'Lagos'])).toBe('Lekki, lagos');
    expect(placeLine([null, ' '])).toBeNull();
  });
});

describe('eventWhenLabel', () => {
  it('reads the day and the Lagos 12-hour time', () => {
    expect(eventWhenLabel('2026-10-17T00:00:00', '2026-10-17T18:00:00+00:00')).toBe(
      'Sat 17 Oct · 7:00 pm',
    );
  });
  it('tolerates a bare time and a missing one', () => {
    expect(eventWhenLabel('2026-10-17', '09:30:00')).toBe('Sat 17 Oct · 9:30 am');
    expect(eventWhenLabel('2026-10-17', null)).toBe('Sat 17 Oct');
  });
  it('is null without a readable date', () => {
    expect(eventWhenLabel(null, null)).toBeNull();
    expect(eventWhenLabel('soon', '19:00')).toBeNull();
  });
});

describe('cardOf', () => {
  it('a hotel: city and state, rating, From price per night', () => {
    expect(cardOf('hotels', hotel(), NOW)).toEqual({
      kind: 'hotel',
      id: 'h1',
      title: 'Harbour Suites',
      area: 'Ikeja, Lagos',
      image: 'https://cdn.test/h1.jpg',
      rating: { avg: 4.6, count: 23 },
      price: { amount: 45000, unit: 'night', prefix: 'From' },
      when: null,
    });
  });

  it('a hotel with price 0 says "See rooms for prices" (Review Focus 2)', () => {
    expect(cardOf('hotels', hotel({ price: 0 }), NOW).price).toEqual({
      text: 'See rooms for prices',
    });
  });

  it('an apartment: area line, no rating without reviews, per-night price', () => {
    const c = cardOf('serviced_apartments', apartment(), NOW);
    expect(c.kind).toBe('apartment');
    expect(c.area).toBe('Lekki, Lagos');
    expect(c.rating).toBeNull();
    expect(c.image).toBeNull();
    expect(c.price).toEqual({ amount: 30000, unit: 'night', varies: false });
  });

  it('an event: date chip instead of a rating, https image, Free at 0', () => {
    const c = cardOf('events', event(), NOW);
    expect(c.kind).toBe('event');
    expect(c.when).toBe('Sat 17 Oct · 7:00 pm');
    expect(c.rating).toBeNull();
    expect(c.image).toBe('https://cdn.test/e.jpg');
    expect(c.price).toEqual({ amount: 5000 });
    expect(cardOf('events', event({ price: 0 }), NOW).price).toEqual({ text: 'Free' });
    expect(cardOf('events', event({ price: null }), NOW).price).toBeNull();
  });

  it('an event whose start has passed reads "Started" instead of its date (K4)', () => {
    const started = cardOf(
      'events',
      event({ event_date: '2026-10-13T00:00:00', event_time: '2026-10-13T08:00:00+00:00' }),
      NOW,
    );
    expect(started.when).toBe('Started');
    expect(cardOf('events', event(), NOW).when).not.toBe('Started');
  });

  it('a blank title is null (the card shows its kind word)', () => {
    expect(cardOf('hotels', hotel({ title: '  ' }), NOW).title).toBeNull();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { Platform, Share } from 'react-native';

import type { ApartmentListing, HotelListing } from '@/features/customer/api/listingDetailDb';
import { useListing } from '@/features/customer/hooks/useListing';
import { useReviews } from '@/features/customer/hooks/useReviews';
import { useSaved, type Saved } from '@/features/customer/hooks/useSaved';
import { WEB_NOTE_KEY } from '@/features/customer/hooks/useWebNote';
import {
  apartmentDetail,
  eventDetail,
  hotelDetail,
  roomRate,
  roomType,
  type EventDetail,
} from '@/features/customer/schemas/listings';
import { ListingScreen } from '@/features/customer/screens/ListingScreen';
import { plainKv } from '@/shared/platform/storage';

// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/customer/hooks/useListing', () => ({ useListing: jest.fn() }));
jest.mock('@/features/customer/hooks/useSaved', () => ({ useSaved: jest.fn() }));
jest.mock('@/features/customer/hooks/useReviews', () => ({ useReviews: jest.fn() }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })),
}));
jest.mock('@/shared/platform/storage', () => {
  const m = new Map<string, string>();
  return {
    plainKv: {
      get: jest.fn((k: string) => Promise.resolve(m.get(k) ?? null)),
      set: jest.fn((k: string, v: string) => {
        m.set(k, v);
        return Promise.resolve();
      }),
      delete: jest.fn((k: string) => {
        m.delete(k);
        return Promise.resolve();
      }),
    },
  };
});
const mockNow = Date.parse('2026-10-13T11:00:00Z'); // Tue 13 Oct, 12:00 Lagos

const mockListing = jest.mocked(useListing);
const mockSaved = jest.mocked(useSaved);
const mockReviews = jest.mocked(useReviews);
const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';
const PHONE = '08031234567';
const HOTEL_URL = `https://bookhushly.com/services/hotels/${ID}`;

// Raw rows as the database sends them, private fields included: the schemas must drop them.
const PRIVATE = {
  vendor_phone: PHONE,
  whatsapp_number: PHONE,
  caretaker_phone: PHONE,
  agent_phone: PHONE,
};
const HOTEL: HotelListing = {
  hotel: hotelDetail.parse({
    ...PRIVATE,
    id: ID,
    name: 'Harbour Suites',
    description: '<p>Pool &amp; <b>gym</b>.</p><script>alert(1)</script>',
    address: '12 Marina Rd',
    city: 'Ikeja',
    state: 'Lagos',
    image_urls: ['https://cdn.test/1.jpg', 'http://cdn.test/2.jpg', 'https://cdn.test/3.jpg'],
    amenities: ['Pool', 'Gym', 'Wifi', 'Spa', 'Bar', 'Lounge', 'Parking'],
    check_in_time: '14:00',
    check_out_time: '12:00',
    breakfast_offered: 'included',
    avg_rating: 4.6,
    review_count: 5,
  }),
  roomTypes: [
    roomType.parse({
      id: 'rt1',
      hotel_id: ID,
      name: 'Deluxe king',
      max_occupancy: 2,
      base_price: 60000,
      size_sqm: 28,
    }),
  ],
  rates: [
    roomRate.parse({
      id: 'r1',
      room_type_id: 'rt1',
      beds: { king: 1, queen: 0, double: 0, single: 0 },
      price_per_night: 55000,
      is_default: true,
    }),
  ],
};
const APARTMENT: ApartmentListing = {
  apartment: apartmentDetail.parse({
    ...PRIVATE,
    id: ID,
    name: 'Lekki Loft',
    area: 'Lekki',
    city: 'Lagos',
    bedrooms: 2,
    price_per_night: 80000,
    price_per_week: 500000,
    minimum_stay: 2,
    caution_deposit: 50000,
    house_rules: 'No parties &amp; no smoking',
    status: 'active',
    avg_rating: null,
    review_count: 0,
  }),
  rules: [
    {
      id: 'p1',
      label: 'Christmas',
      start_date: '2026-12-20',
      end_date: '2027-01-02',
      price_per_night: 90000,
    },
  ],
};
const PKG = { name: 'Regular', price: 10000, remaining: 40, total: 200 };
function event(over: Record<string, unknown> = {}): EventDetail {
  return eventDetail.parse({
    ...PRIVATE,
    id: ID,
    title: 'Afrobeats night',
    description: 'Live band',
    location: 'Eko Hotel, Lagos',
    vendor_name: 'Eko Live',
    active: true,
    availability: 'available',
    event_date: '2026-10-17T00:00:00',
    event_time: '2026-10-17T18:00:00+00:00',
    ticket_packages: [
      { ...PKG, early_bird_price: 7000, early_bird_end: '2026-10-16T22:59:00Z' },
      { name: 'VIP', price: 25000, remaining: 10, total: 50 },
    ],
    ...over,
  });
}

const SAVED: Saved = {
  items: [],
  ready: true,
  loading: false,
  error: false,
  refetch: jest.fn(() => Promise.resolve()),
  isSaved: () => false,
  toggle: jest.fn(() => Promise.resolve('ok' as const)),
  lastRemoved: null,
  undo: jest.fn(() => Promise.resolve(null)),
  dismissUndo: jest.fn(),
  writeError: null,
  clearWriteError: jest.fn(),
};
const REVIEWS: ReturnType<typeof useReviews> = {
  reviews: [
    {
      id: 'rv1',
      customerName: 'Ada',
      rating: 5,
      comment: '<p>Lovely&nbsp;stay</p>',
      verified: true,
      createdAt: '2026-10-01T10:00:00Z',
      vendorResponse: null,
      vendorResponseDate: null,
    },
  ],
  total: 5,
  loading: false,
  failed: false,
  retryAfterSec: null,
  hasMore: true,
  loadingMore: false,
  loadMore: jest.fn(),
  refetch: jest.fn(() => Promise.resolve()),
};

function show(
  data: HotelListing | ApartmentListing | EventDetail | null | undefined,
  error = false,
) {
  mockListing.mockReturnValue({ data, error, refetch: jest.fn(() => Promise.resolve()) });
}
const props = { id: ID, userId: 'u1', onBack: jest.fn(), onSignInAgain: jest.fn() };
const allText = () => JSON.stringify(screen.toJSON());

beforeEach(async () => {
  jest.clearAllMocks();
  mockSaved.mockReturnValue(SAVED);
  mockReviews.mockReturnValue(REVIEWS);
  await plainKv.delete(WEB_NOTE_KEY);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('hotel', () => {
  it('shows rooms, the from-price, plain-text description and the first reviews', async () => {
    show(HOTEL);
    await render(<ListingScreen kind="hotel" {...props} />);
    expect(screen.getByTestId('listing-title')).toHaveTextContent('Harbour Suites');
    expect(within(screen.getByTestId('room-rt1')).getByText('Deluxe king')).toBeTruthy();
    expect(screen.getByText('Up to 2 guests · 1 king bed · 28 m²')).toBeTruthy();
    expect(
      within(screen.getByTestId('listing-footer')).getByLabelText('From 55,000 naira per night'),
    ).toBeTruthy();
    expect(screen.getByTestId('description')).toHaveTextContent('Pool & gym.');
    expect(allText()).not.toMatch(/<p>|<b>|<script|alert\(/);
    expect(screen.getByText('Breakfast included')).toBeTruthy();
    expect(screen.getByText('From 2:00 pm')).toBeTruthy();
    expect(mockReviews).toHaveBeenCalledWith('hotel', ID, 3);
    expect(screen.getByText('Lovely stay')).toBeTruthy();
    expect(screen.getByText('See all reviews (5)')).toBeTruthy();
    expect(screen.getByText('All amenities (7)')).toBeTruthy();
    expect(allText()).not.toContain(PHONE);
  });

  it('notes the web sign-in once, then opens the hotel page in the in-app browser', async () => {
    show(HOTEL);
    await render(<ListingScreen kind="hotel" {...props} />);
    expect(await screen.findByText('You may need to sign in on the website.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Book on bookhushly.com'));
    expect(openBrowserAsync).toHaveBeenCalledWith(`https://bookhushly.com/services/hotels/${ID}`);
    expect(screen.queryByText('You may need to sign in on the website.')).toBeNull();
    expect(await plainKv.get(WEB_NOTE_KEY)).toBe('1');
  });

  it.each([
    ['ios', { title: 'Harbour Suites', message: 'Harbour Suites', url: HOTEL_URL }],
    ['android', { title: 'Harbour Suites', message: `Harbour Suites\n${HOTEL_URL}` }],
  ])('shares the title with the web link once on %s', async (os, payload) => {
    jest.replaceProperty(Platform, 'OS', os as typeof Platform.OS);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    show(HOTEL);
    await render(<ListingScreen kind="hotel" {...props} />);
    await fireEvent.press(screen.getByTestId('listing-share'));
    expect(share).toHaveBeenCalledWith(payload);
    share.mockRestore();
  });

  it('saves with a snapshot from the heart', async () => {
    show(HOTEL);
    await render(<ListingScreen kind="hotel" {...props} />);
    await fireEvent.press(screen.getByTestId('listing-heart'));
    expect(SAVED.toggle).toHaveBeenCalledWith({
      listingId: ID,
      kind: 'hotel',
      title: 'Harbour Suites',
      image: 'https://cdn.test/1.jpg',
      location: 'Ikeja, Lagos',
    });
  });

  it('pages https photos with a counter and opens the full-screen viewer', async () => {
    show(HOTEL);
    await render(<ListingScreen kind="hotel" {...props} />);
    await fireEvent(screen.getByTestId('gallery'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 200 } },
    });
    // The counter is hidden from screen readers (each photo says "Photo 1 of 2").
    expect(
      screen.getByTestId('gallery-counter', { includeHiddenElements: true }),
    ).toHaveTextContent('1/2');
    await fireEvent.press(screen.getByLabelText('Photo 2 of 2, Harbour Suites'));
    expect(screen.getByTestId('viewer-counter')).toHaveTextContent('2/2');
  });
});

describe('apartment', () => {
  it('shows prices, seasonal rules, minimum stay, deposit and house rules', async () => {
    show(APARTMENT);
    await render(<ListingScreen kind="apartment" {...props} />);
    expect(screen.getByText('Prices vary by date')).toBeTruthy();
    expect(screen.getByText('Christmas · 20 Dec – 2 Jan: ₦90,000 per night')).toBeTruthy();
    expect(screen.getByText('2 nights')).toBeTruthy();
    expect(screen.getByText('₦50,000')).toBeTruthy();
    expect(screen.getByText('No parties & no smoking')).toBeTruthy();
    expect(screen.getByLabelText('80,000 naira per night')).toBeTruthy();
    expect(mockReviews).toHaveBeenCalledWith('apartment', ID, 3);
    expect(screen.getByText('Book on bookhushly.com')).toBeTruthy();
    expect(allText()).not.toContain(PHONE);
  });
});

describe('apartment prices and reviews', () => {
  it('reads every amount as words', async () => {
    show(APARTMENT);
    await render(<ListingScreen kind="apartment" {...props} />);
    const prices = within(screen.getByTestId('prices'));
    expect(prices.getByLabelText('Per night, 80,000 naira per night')).toBeTruthy();
    expect(prices.getByLabelText('Per week, 500,000 naira per week')).toBeTruthy();
    expect(prices.getByLabelText('Caution deposit, 50,000 naira')).toBeTruthy();
    expect(
      prices.getByLabelText('Christmas · 20 Dec – 2 Jan, 90,000 naira per night'),
    ).toBeTruthy();
  });

  it('has no Prices heading with nothing under it', async () => {
    show({
      apartment: {
        ...APARTMENT.apartment,
        price_per_night: null,
        price_per_week: null,
        minimum_stay: 1,
        caution_deposit: null,
      },
      rules: [],
    });
    await render(<ListingScreen kind="apartment" {...props} />);
    expect(screen.queryByTestId('prices')).toBeNull();
    expect(screen.queryByText('Prices')).toBeNull();
  });

  it('offers Try again when the reviews fail to load', async () => {
    const refetch = jest.fn(() => Promise.resolve());
    mockReviews.mockReturnValue({ ...REVIEWS, reviews: [], total: 0, failed: true, refetch });
    show(APARTMENT);
    await render(<ListingScreen kind="apartment" {...props} />);
    expect(screen.getByText('Couldn’t load reviews — check your connection.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('event', () => {
  it('shows date, venue, organizer, tickets with early bird and the from-price', async () => {
    show(event());
    await render(<ListingScreen kind="event" {...props} />);
    expect(screen.getByText('Sat 17 Oct · 7:00 pm')).toBeTruthy();
    expect(screen.getByText('Eko Hotel, Lagos')).toBeTruthy();
    expect(screen.getByText('Eko Live')).toBeTruthy();
    expect(screen.getByText('Early bird until Fri 16 Oct')).toBeTruthy();
    // D12 wording, the web's thresholds (50 by default; ≤ 15 is almost sold out).
    expect(within(screen.getByTestId('ticket-VIP')).getByText('Almost sold out')).toBeTruthy();
    expect(within(screen.getByTestId('ticket-Regular')).getByText('Few tickets left')).toBeTruthy();
    expect(screen.getByLabelText('From 7,000 naira')).toBeTruthy();
    expect(screen.getByText('· Sat 17 Oct')).toBeTruthy();
    await fireEvent.press(screen.getByText('Get tickets on bookhushly.com'));
    expect(openBrowserAsync).toHaveBeenCalledWith(`https://bookhushly.com/services/${ID}`);
    expect(mockReviews).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reviews')).toBeNull();
    expect(allText()).not.toContain(PHONE);
  });

  it.each([
    [
      'sold out',
      { ticket_packages: [{ ...PKG, remaining: 0 }] },
      'Sold out',
      'Sold out. Every ticket type is gone.',
    ],
    [
      'ended',
      { event_date: '2026-10-10T00:00:00' },
      'This event has ended',
      'This event has ended.',
    ],
    ['not on sale', { active: false }, 'Not on sale', 'Tickets aren’t on sale right now.'],
  ])('never offers tickets when %s', async (_, over, button, banner) => {
    show(event(over));
    await render(<ListingScreen kind="event" {...props} />);
    expect(screen.getByText(banner)).toBeTruthy();
    expect(screen.queryByText('Get tickets on bookhushly.com')).toBeNull();
    const book = screen.getByTestId('listing-book');
    expect(within(book).getByText(button)).toBeTruthy();
    expect(book).toBeDisabled();
    await fireEvent.press(book);
    expect(openBrowserAsync).not.toHaveBeenCalled();
    expect(screen.queryByText('You may need to sign in on the website.')).toBeNull();
  });
});

describe('states', () => {
  it('a hidden or missing listing is not available', async () => {
    show(null);
    await render(<ListingScreen kind="hotel" {...props} />);
    expect(screen.getByText('This listing isn’t available right now')).toBeTruthy();
    expect(screen.queryByTestId('listing-footer')).toBeNull();
  });

  it('a failed load offers a retry, never "not available"', async () => {
    show(undefined, true);
    await render(<ListingScreen kind="event" {...props} />);
    expect(screen.getByText('Couldn’t load this listing')).toBeTruthy();
    expect(screen.queryByText('This listing isn’t available right now')).toBeNull();
  });
});

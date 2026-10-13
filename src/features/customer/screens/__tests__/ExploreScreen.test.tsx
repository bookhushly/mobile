import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { SavedInput } from '@/features/customer/api/savedDb';
import type { Category, Place } from '@/features/customer/domain/discover';
import { fromEvent, fromHotel, splitBookings } from '@/features/customer/domain/myBookings';
import { useExplorePlace } from '@/features/customer/hooks/useExplorePlace';
import { useListingsRail, type RailListings } from '@/features/customer/hooks/useListings';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import { useSaved, type Saved } from '@/features/customer/hooks/useSaved';
import { NOTICE_MS, NOTICE_READER_MS } from '@/features/customer/hooks/useSavedNotices';
import type { ApartmentItem, EventItem, HotelItem } from '@/features/customer/schemas/listings';
import { ExploreScreen } from '@/features/customer/screens/ExploreScreen';

import { ev, ho, TODAY } from '../../hooks/__tests__/customerTestUtils';

// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/customer/hooks/useMyBookings', () => ({ useMyBookings: jest.fn() }));
jest.mock('@/features/customer/hooks/useSaved', () => ({ useSaved: jest.fn() }));
jest.mock('@/features/customer/hooks/useExplorePlace', () => ({ useExplorePlace: jest.fn() }));
jest.mock('@/features/customer/hooks/useListings', () => ({ useListingsRail: jest.fn() }));
let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-10-13T11:00:00Z');

const mockMy = jest.mocked(useMyBookings);
const mockSaved = jest.mocked(useSaved);
const mockPlace = jest.mocked(useExplorePlace);
const mockListings = jest.mocked(useListingsRail);

const LAGOS: Place = { label: 'Lagos', state: 'Lagos' };

const HOTEL: HotelItem = {
  id: 'h1',
  title: 'Harbour Suites',
  location: 'Ikeja, Lagos',
  price: 0,
  media_urls: null,
  city: 'Ikeja',
  state: 'Lagos',
  avg_rating: null,
  review_count: 0,
  breakfast_offered: null,
  generator_available: null,
};
const APARTMENT: ApartmentItem = {
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
  avg_rating: 4.5,
  review_count: 2,
  furnished: true,
};
const EVENT: EventItem = {
  id: 'e1',
  title: 'Afrobeats night',
  location: 'Eko Hotel',
  price: 5000,
  media_urls: null,
  vendor_name: null,
  event_date: '2026-10-17T00:00:00',
  event_time: '2026-10-17T18:00:00+00:00',
  category_data: null,
};

type AnyListings = RailListings<HotelItem | ApartmentItem | EventItem>;
function listings(items: AnyListings['items'], over: Partial<AnyListings> = {}): AnyListings {
  return {
    items,
    loading: false,
    failed: false,
    error: null,
    retryAfterSec: null,
    refetch: jest.fn(() => Promise.resolve()),
    ...over,
  };
}

let byCat: Record<Category, AnyListings>;

// A small stand-in for useSaved's optimistic state: saved keys, lastRemoved and undo.
let mockWriteError: Saved['writeError'] = null;
function useFakeSaved(): Saved {
  const [keys, setKeys] = useState<string[]>([]);
  const [lastRemoved, setLastRemoved] = useState<SavedInput | null>(null);
  const [writeError, setWriteError] = useState(mockWriteError);
  const k = (kind: string, id: string) => `${kind}:${id}`;
  return {
    items: [],
    ready: true,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    isSaved: (kind, id) => keys.includes(k(kind, id)),
    toggle: (item) => {
      const key = k(item.kind, item.listingId);
      if (keys.includes(key)) {
        setKeys(keys.filter((x) => x !== key));
        setLastRemoved(item);
      } else setKeys([...keys, key]);
      return Promise.resolve('ok');
    },
    lastRemoved,
    undo: () => {
      if (lastRemoved === null) return Promise.resolve(null);
      setKeys([...keys, k(lastRemoved.kind, lastRemoved.listingId)]);
      setLastRemoved(null);
      return Promise.resolve('ok');
    },
    dismissUndo: () => {
      setLastRemoved(null);
    },
    writeError,
    clearWriteError: () => {
      setWriteError(null);
    },
  };
}

function props() {
  return {
    userId: 'u1',
    onOpenSearch: jest.fn(),
    onOpenResults: jest.fn(),
    onOpenListing: jest.fn(),
    onShowTickets: jest.fn(),
    onShowCheckInCode: jest.fn(),
    onSignInAgain: jest.fn(),
  };
}

afterEach(() => {
  jest.useRealTimers();
});
beforeEach(() => {
  // Fake timers: FlatList's cell-batching timer otherwise fires between act() scopes.
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockFocused = true;
  mockWriteError = null;
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  byCat = {
    hotels: listings([HOTEL]),
    serviced_apartments: listings([APARTMENT]),
    events: listings([EVENT]),
  };
  mockListings.mockImplementation((cat) => byCat[cat]);
  mockMy.mockReturnValue({
    bookings: { today: [], upcoming: [], past: [] },
    rows: null,
    saved: null,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
  mockSaved.mockImplementation(useFakeSaved);
  mockPlace.mockImplementation(() => {
    const [place, setPlace] = useState<Place | null>(LAGOS);
    return { place, setPlace };
  });
});

it('renders a rail per category with See all', async () => {
  const p = props();
  await render(<ExploreScreen {...p} />);
  expect(screen.getByRole('header', { name: 'Happening soon' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Hotels in Lagos' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Apartments in Lagos' })).toBeTruthy();
  expect(within(screen.getByTestId('rail-events')).getByText('Afrobeats night')).toBeTruthy();
  expect(within(screen.getByTestId('rail-events')).getByText('Sat 17 Oct · 7:00 pm')).toBeTruthy();
  expect(within(screen.getByTestId('rail-hotels')).getByText('Harbour Suites')).toBeTruthy();
  // Review Focus 2: a hotel with price 0.
  expect(within(screen.getByTestId('rail-hotels')).getByText('See rooms for prices')).toBeTruthy();
  expect(within(screen.getByTestId('rail-apartments')).getByText('Lekki loft')).toBeTruthy();

  expect(mockListings).toHaveBeenCalledWith('events', { q: '' }, { sort: 'top_rated' });
  await fireEvent.press(screen.getByRole('link', { name: 'See all, Hotels in Lagos' }));
  expect(p.onOpenResults).toHaveBeenCalledWith({ category: 'hotels', region: 'Lagos' });
  await fireEvent.press(screen.getByRole('button', { name: 'Events' }));
  expect(p.onOpenResults).toHaveBeenCalledWith({ category: 'events' });
  await fireEvent.press(
    screen.getByRole('button', { name: 'Search hotels, apartments and events' }),
  );
  expect(p.onOpenSearch).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: /^Lekki loft, Lekki, Lagos/ }));
  expect(p.onOpenListing).toHaveBeenCalledWith('apartment', 'a1');
});

it('a failed rail offers Try again; an empty rail is one line', async () => {
  byCat.hotels = listings([], { failed: true });
  byCat.serviced_apartments = listings([]);
  await render(<ExploreScreen {...props()} />);
  await fireEvent.press(
    within(screen.getByTestId('rail-hotels-error')).getByRole('button', { name: 'Try again' }),
  );
  expect(byCat.hotels.refetch).toHaveBeenCalled();
  expect(screen.getByText('No apartments in Lagos yet.')).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'Apartments in Lagos' })).toBeNull();
  // The events rail is untouched by the others.
  expect(screen.getByText('Afrobeats night')).toBeTruthy();
});

it('a 429 waits before offering Try again', async () => {
  byCat.events = listings([], { failed: true, retryAfterSec: 10 });
  await render(<ExploreScreen {...props()} />);
  const err = screen.getByTestId('rail-events-error');
  expect(within(err).getByText(/Try again in a few seconds/)).toBeTruthy();
  expect(within(err).queryByRole('button', { name: 'Try again' })).toBeNull();
});

it('shows the Today banner and its action opens the ticket', async () => {
  const tonight = ev({
    id: 'b-today',
    listing: {
      id: 'l2',
      title: 'Jazz at the lagoon',
      location: 'Lagos',
      media_urls: [],
      event_date: `${TODAY}T00:00:00`,
      event_end_date: null,
      event_time: `${TODAY}T18:00:00+00:00`,
      require_dynamic_ticket: true,
    },
  });
  mockMy.mockReturnValue({
    bookings: splitBookings([fromEvent(tonight, TODAY)]),
    rows: { events: [tonight], hotels: [], apartments: [] },
    saved: null,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
  const p = props();
  await render(<ExploreScreen {...p} />);
  expect(screen.getByText('Your event starts at 7:00 pm · Jazz at the lagoon')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Today: Your event starts at 7:00 pm, Jazz at the lagoon. Show ticket',
    }),
  );
  expect(p.onShowTickets).toHaveBeenCalledWith('b-today');
});

it('no Today banner without a booking today', async () => {
  await render(<ExploreScreen {...props()} />);
  expect(screen.queryByTestId('today-banner')).toBeNull();
});

it('the place chip changes the stays query', async () => {
  await render(<ExploreScreen {...props()} />);
  expect(mockListings).toHaveBeenCalledWith(
    'hotels',
    { q: '', state: 'Lagos' },
    { sort: 'newest' },
    { enabled: true },
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Where to? Lagos. Change place' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Abuja' }));
  expect(mockListings).toHaveBeenLastCalledWith(
    'serviced_apartments',
    { q: '', state: 'FCT' },
    { sort: 'newest' },
    { enabled: true },
  );
  expect(mockListings).toHaveBeenCalledWith(
    'hotels',
    { q: '', state: 'FCT' },
    { sort: 'newest' },
    { enabled: true },
  );
  expect(screen.getByRole('header', { name: 'Hotels in Abuja' })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Where to? Abuja. Change place' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Port Harcourt' }));
  expect(mockListings).toHaveBeenCalledWith(
    'hotels',
    { q: '', city: 'Port Harcourt' },
    { sort: 'newest' },
    { enabled: true },
  );
});

it('stays wait for the place before loading', async () => {
  mockPlace.mockReturnValue({ place: null, setPlace: jest.fn() });
  await render(<ExploreScreen {...props()} />);
  expect(mockListings).toHaveBeenCalledWith(
    'hotels',
    { q: '' },
    { sort: 'newest' },
    {
      enabled: false,
    },
  );
});

it('the heart saves, unsaves with Undo, and Undo saves again', async () => {
  await render(<ExploreScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Save Harbour Suites' }));
  expect(
    screen.getByRole('button', { name: 'Remove Harbour Suites from saved', selected: true }),
  ).toBeTruthy();
  expect(screen.queryByTestId('saved-undo')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Remove Harbour Suites from saved' }));
  expect(screen.getByRole('button', { name: 'Save Harbour Suites', selected: false })).toBeTruthy();
  expect(screen.getByText('Removed Harbour Suites from saved.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('button', { name: 'Remove Harbour Suites from saved' })).toBeTruthy();
  expect(screen.queryByTestId('saved-undo')).toBeNull();
});

it('a stale session on a heart offers Sign in again', async () => {
  mockSaved.mockImplementation(() => ({ ...useFakeSaved(), writeError: 'stale' }));
  const p = props();
  await render(<ExploreScreen {...p} />);
  expect(screen.getByText('Couldn’t save. Sign in again if this keeps happening.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in again' }));
  expect(p.onSignInAgain).toHaveBeenCalled();
});

it('the toggle sends the card snapshot', async () => {
  const toggle = jest.fn(() => Promise.resolve('ok' as const));
  mockSaved.mockImplementation(() => ({ ...useFakeSaved(), toggle }));
  await render(<ExploreScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Save Lekki loft' }));
  expect(toggle).toHaveBeenCalledWith({
    listingId: 'a1',
    kind: 'apartment',
    title: 'Lekki loft',
    image: null,
    location: 'Lekki, Lagos',
  });
});

it('Today: a stay opens its check-in code', async () => {
  const stay = ho({ id: 'h-today' });
  mockMy.mockReturnValue({
    bookings: splitBookings([fromHotel(stay, TODAY)]),
    rows: { events: [], hotels: [stay], apartments: [] },
    saved: null,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
  const p = props();
  await render(<ExploreScreen {...p} />);
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Today: Check-in today from 2:00 pm, Harbour Suites. Show check-in code',
    }),
  );
  expect(p.onShowCheckInCode).toHaveBeenCalledWith('h-today');
  expect(p.onShowTickets).not.toHaveBeenCalled();
});

it('pull to refresh refetches every rail, bookings and saved, and clears old notices', async () => {
  const refetchMy = jest.fn(() => Promise.resolve());
  mockMy.mockReturnValue({
    bookings: { today: [], upcoming: [], past: [] },
    rows: null,
    saved: null,
    loading: false,
    error: false,
    refetch: refetchMy,
  });
  const refetchSaved = jest.fn(() => Promise.resolve());
  mockSaved.mockImplementation(() => ({ ...useFakeSaved(), refetch: refetchSaved }));
  await render(<ExploreScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Save Harbour Suites' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Harbour Suites from saved' }));
  expect(screen.getByTestId('saved-undo')).toBeTruthy();
  await pullToRefresh();
  expect(byCat.events.refetch).toHaveBeenCalled();
  expect(byCat.hotels.refetch).toHaveBeenCalled();
  expect(byCat.serviced_apartments.refetch).toHaveBeenCalled();
  expect(refetchMy).toHaveBeenCalled();
  expect(refetchSaved).toHaveBeenCalled();
  expect(screen.queryByTestId('saved-undo')).toBeNull();
});

it('See all from a city-only place sends the city', async () => {
  mockPlace.mockReturnValue({
    place: { label: 'Port Harcourt', city: 'Port Harcourt' },
    setPlace: jest.fn(),
  });
  const p = props();
  await render(<ExploreScreen {...p} />);
  await fireEvent.press(screen.getByRole('link', { name: 'See all, Apartments in Port Harcourt' }));
  expect(p.onOpenResults).toHaveBeenCalledWith({
    category: 'serviced_apartments',
    city: 'Port Harcourt',
  });
});

// The pull gesture: the RefreshControl handed to Explore's scroll view (the host mock renders it
// without props, so it is read from the nearest ancestor that carries it).
async function pullToRefresh() {
  let node = screen.getByRole('button', { name: 'Search hotels, apartments and events' }).parent;
  while (node !== null && node.props.refreshControl === undefined) node = node.parent;
  const control: unknown = node?.props.refreshControl;
  const onRefresh: unknown =
    typeof control === 'object' && control !== null
      ? Reflect.get(Reflect.get(control, 'props') ?? {}, 'onRefresh')
      : undefined;
  if (typeof onRefresh !== 'function') throw new Error('no RefreshControl');
  await act(async () => {
    Reflect.apply(onRefresh, undefined, []);
    await Promise.resolve();
  });
}

async function unsaveHarbour() {
  await fireEvent.press(screen.getByRole('button', { name: 'Save Harbour Suites' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Harbour Suites from saved' }));
  expect(screen.getByTestId('saved-undo')).toBeTruthy();
}

it('the Undo banner goes after a few seconds', async () => {
  await render(<ExploreScreen {...props()} />);
  await unsaveHarbour();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(NOTICE_MS - 1);
  });
  expect(screen.getByTestId('saved-undo')).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(screen.queryByTestId('saved-undo')).toBeNull();
});

it('with a screen reader on, the Undo banner stays longer', async () => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  await render(<ExploreScreen {...props()} />);
  await unsaveHarbour();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(NOTICE_MS);
  });
  expect(screen.getByTestId('saved-undo')).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(NOTICE_READER_MS - NOTICE_MS);
  });
  expect(screen.queryByTestId('saved-undo')).toBeNull();
});

it('leaving the screen dismisses the Undo banner', async () => {
  const view = await render(<ExploreScreen {...props()} />);
  await unsaveHarbour();
  mockFocused = false;
  await view.rerender(<ExploreScreen {...props()} />);
  expect(screen.queryByTestId('saved-undo')).toBeNull();
});

it('a transient save error goes after a few seconds; a stale one stays', async () => {
  mockWriteError = 'transient';
  const view = await render(<ExploreScreen {...props()} />);
  expect(screen.getByTestId('saved-transient')).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(NOTICE_MS);
  });
  expect(screen.queryByTestId('saved-transient')).toBeNull();
  await view.unmount();

  mockWriteError = 'stale';
  await render(<ExploreScreen {...props()} />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(NOTICE_READER_MS * 2);
  });
  expect(screen.getByTestId('saved-stale')).toBeTruthy();
});

it('a saved list that can’t load says why the hearts are off', async () => {
  mockSaved.mockImplementation(() => ({ ...useFakeSaved(), ready: false, error: true }));
  await render(<ExploreScreen {...props()} />);
  expect(
    within(screen.getByTestId('saved-load-error')).getByText(
      'Couldn’t load your saved list — pull to refresh.',
    ),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save Harbour Suites' })).toBeDisabled();
});

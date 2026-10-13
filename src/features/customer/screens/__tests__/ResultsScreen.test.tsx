import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { Filters } from '@/features/customer/domain/discover';
import type { ResultsQuery } from '@/features/customer/domain/routeParams';
import { useListings, type Listings } from '@/features/customer/hooks/useListings';
import { useSaved, type Saved } from '@/features/customer/hooks/useSaved';
import type { EventItem, HotelItem } from '@/features/customer/schemas/listings';
import { ResultsScreen } from '@/features/customer/screens/ResultsScreen';
import type { ApiError } from '@/shared/lib/errors';

// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/customer/hooks/useSaved', () => ({ useSaved: jest.fn() }));
jest.mock('@/features/customer/hooks/useListings', () => ({ useListings: jest.fn() }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-10-13T11:00:00Z');

const mockSaved = jest.mocked(useSaved);
const mockListings = jest.mocked(useListings);

const hotel = (id: string, title: string): HotelItem => ({
  id,
  title,
  location: 'Ikeja, Lagos',
  price: 45000,
  media_urls: null,
  city: 'Ikeja',
  state: 'Lagos',
  avg_rating: null,
  review_count: 0,
  breakfast_offered: null,
  generator_available: null,
});
const EVENT: EventItem = {
  id: 'e1',
  title: 'Afrobeats night',
  location: 'Eko Hotel',
  price: 5000,
  media_urls: null,
  vendor_name: null,
  event_date: '2026-10-17T00:00:00',
  event_time: null,
  low_stock_threshold: null,
};

type AnyListings = Listings<HotelItem | EventItem>;
function listings(items: AnyListings['items'], over: Partial<AnyListings> = {}): AnyListings {
  return {
    items,
    totalCount: null,
    loading: false,
    failed: false,
    error: null,
    retryAfterSec: null,
    hasMore: false,
    loadingMore: false,
    loadMore: jest.fn(),
    refetch: jest.fn(() => Promise.resolve()),
    ...over,
  };
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

const RATE_LIMITED: ApiError = { kind: 'rateLimited', retryAfterSec: 30 };
let current: AnyListings;

function props(query: Partial<ResultsQuery> = {}) {
  return {
    userId: 'u1',
    query: { category: 'hotels' as const, q: '', state: 'Lagos', ...query },
    onBack: jest.fn(),
    onOpenListing: jest.fn(),
    onSignInAgain: jest.fn(),
  };
}
const lastFilters = (): Filters | undefined => mockListings.mock.lastCall?.[2];

beforeEach(() => {
  // Fake timers: FlatList's cell-batching timer otherwise fires between act() scopes.
  jest.useFakeTimers();
  jest.clearAllMocks();
  current = listings([hotel('h1', 'Harbour Suites'), hotel('h2', 'Bay Lodge')]);
  mockListings.mockImplementation(() => current);
  mockSaved.mockReturnValue(SAVED);
});
afterEach(() => {
  jest.useRealTimers();
});

it('shows the query, the rows and the count only when the route sent one', async () => {
  const p = props({ q: 'Ikeja' });
  const view = await render(<ResultsScreen {...p} />);
  expect(screen.getByRole('header', { name: 'Hotels · “Ikeja” · Lagos' })).toBeTruthy();
  expect(mockListings).toHaveBeenCalledWith(
    'hotels',
    { q: 'Ikeja', state: 'Lagos' },
    { sort: 'newest' },
  );
  expect(screen.queryByTestId('results-count')).toBeNull();
  current = listings(current.items, { totalCount: 1170 });
  await view.rerender(<ResultsScreen {...p} />);
  expect(screen.getByTestId('results-count')).toHaveTextContent('1,170 results');
  await fireEvent.press(screen.getByRole('button', { name: /^Bay Lodge/ }));
  expect(p.onOpenListing).toHaveBeenCalledWith('hotel', 'h2');
});

it('loads the next page at the end, with a spinner while it loads', async () => {
  current = listings(current.items, { hasMore: true });
  const view = await render(<ResultsScreen {...props()} />);
  await fireEvent(screen.getByTestId('results-list'), 'endReached');
  expect(current.loadMore).toHaveBeenCalledTimes(1);
  current = listings(current.items, { hasMore: true, loadingMore: true });
  await view.rerender(<ResultsScreen {...props()} />);
  expect(screen.getByLabelText('Loading more')).toBeTruthy();
});

it('a 429 keeps the rows; Load more comes back after retry_after', async () => {
  const items = current.items;
  current = listings(items, { hasMore: true, error: RATE_LIMITED, retryAfterSec: 30 });
  const view = await render(<ResultsScreen {...props()} />);
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  const footer = () => within(screen.getByTestId('load-more'));
  expect(footer().getByText('Lots of searches right now. Try again in a moment.')).toBeTruthy();
  expect(footer().getByRole('button', { name: 'Load more' })).toBeDisabled();
  // No automatic retry from scrolling after a failure.
  await fireEvent(screen.getByTestId('results-list'), 'endReached');
  expect(current.loadMore).not.toHaveBeenCalled();

  current = listings(items, { hasMore: true, error: RATE_LIMITED, retryAfterSec: null });
  await view.rerender(<ResultsScreen {...props()} />);
  await fireEvent.press(footer().getByRole('button', { name: 'Load more' }));
  expect(current.loadMore).toHaveBeenCalledTimes(1);
});

it('a failed first page is a neutral error with Try again', async () => {
  current = listings([], { failed: true, error: { kind: 'network' } });
  await render(<ResultsScreen {...props()} />);
  expect(screen.getByText('Couldn’t load results')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(current.refetch).toHaveBeenCalled();
});

it('filters apply only on Show results, and the chip counts them', async () => {
  await render(<ResultsScreen {...props()} />);
  expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  const sheet = within(screen.getByTestId('filters-sheet'));
  await fireEvent.press(sheet.getByRole('checkbox', { name: 'Breakfast included' }));
  await fireEvent.press(sheet.getByRole('radio', { name: '4+' }));
  await fireEvent.press(sheet.getByRole('radio', { name: 'Lowest price' }));
  await fireEvent.changeText(sheet.getByLabelText('Minimum (₦)'), '20000');
  // Shown grouped; kept as a whole number.
  expect(sheet.getByLabelText('Minimum (₦)')).toHaveDisplayValue('20,000');
  // Nothing applies while choosing.
  expect(lastFilters()).toEqual({ sort: 'newest' });
  await fireEvent.press(sheet.getByRole('button', { name: 'Show results' }));
  expect(lastFilters()).toEqual({
    sort: 'price_asc',
    minRating: 4,
    breakfastIncluded: true,
    priceMin: 20000,
  });
  // The sort isn't counted: its own chip shows it.
  expect(screen.getByRole('button', { name: 'Filters (3)' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sort: Lowest price' })).toBeTruthy();
});

it('closing the sheet discards the draft', async () => {
  await render(<ResultsScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  const sheet = within(screen.getByTestId('filters-sheet'));
  await fireEvent.press(sheet.getByRole('checkbox', { name: 'Generator' }));
  await fireEvent.press(sheet.getByRole('button', { name: 'Close' }));
  expect(lastFilters()).toEqual({ sort: 'newest' });
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  expect(
    within(screen.getByTestId('filters-sheet')).getByRole('checkbox', { name: 'Generator' }),
  ).not.toBeChecked();
});

it('a minimum above the maximum is a field error, not applied', async () => {
  await render(<ResultsScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  const sheet = within(screen.getByTestId('filters-sheet'));
  await fireEvent.changeText(sheet.getByLabelText('Minimum (₦)'), '50000');
  await fireEvent.changeText(sheet.getByLabelText('Maximum (₦)'), '20000');
  await fireEvent.press(sheet.getByRole('button', { name: 'Show results' }));
  expect(sheet.getByText('The maximum must be at least the minimum.')).toBeTruthy();
  expect(lastFilters()).toEqual({ sort: 'newest' });
});

it('hotel filters never offer bed size, floor or dates; events get dates', async () => {
  const view = await render(<ResultsScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  const hotelSheet = within(screen.getByTestId('filters-sheet'));
  for (const word of [/bed/i, /floor/i, /date/i, /check-?in/i, /today/i, /weekend/i])
    expect(hotelSheet.queryByText(word)).toBeNull();
  expect(hotelSheet.getByText('Guest rating')).toBeTruthy();

  current = listings([EVENT]);
  await view.rerender(<ResultsScreen {...props({ category: 'events' })} />);
  const eventSheet = within(screen.getByTestId('filters-sheet'));
  expect(eventSheet.getByRole('radio', { name: 'Soonest' })).toBeTruthy();
  await fireEvent.press(eventSheet.getByRole('radio', { name: 'Pick a date' }));
  await fireEvent.press(eventSheet.getByRole('radio', { name: 'Tue 20 Oct' }));
  await fireEvent.press(eventSheet.getByRole('button', { name: 'Show results' }));
  expect(lastFilters()).toEqual({ sort: 'newest', eventDate: '2026-10-20' });
});

it('no matches: says so, and Clear filters resets them', async () => {
  await render(<ResultsScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEvent.press(
    within(screen.getByTestId('filters-sheet')).getByRole('checkbox', {
      name: 'Breakfast included',
    }),
  );
  current = listings([]);
  await fireEvent.press(
    within(screen.getByTestId('filters-sheet')).getByRole('button', { name: 'Show results' }),
  );
  const empty = within(screen.getByTestId('results-empty'));
  expect(empty.getByText('No matches')).toBeTruthy();
  expect(empty.getByText('Try a different place or fewer filters.')).toBeTruthy();
  await fireEvent.press(empty.getByRole('button', { name: 'Clear filters' }));
  expect(lastFilters()).toEqual({ sort: 'newest' });
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
});

it('sort applies from its own sheet', async () => {
  await render(<ResultsScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sort: Newest' }));
  await fireEvent.press(
    within(screen.getByTestId('sort-sheet')).getByRole('radio', { name: 'Top rated' }),
  );
  expect(lastFilters()).toEqual({ sort: 'top_rated' });
  expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
});

it('a sort alone never offers Clear filters on an empty list', async () => {
  current = listings([]);
  await render(<ResultsScreen {...props()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sort: Newest' }));
  await fireEvent.press(
    within(screen.getByTestId('sort-sheet')).getByRole('radio', { name: 'Highest price' }),
  );
  expect(screen.getByTestId('results-empty')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
});

it('pages that held nothing yet say so above Load more', async () => {
  current = listings([], { hasMore: true });
  await render(<ResultsScreen {...props({ category: 'events' })} />);
  expect(screen.queryByTestId('results-empty')).toBeNull();
  const footer = within(screen.getByTestId('load-more'));
  expect(footer.getByText('Nothing here yet — load more to keep looking.')).toBeTruthy();
  await fireEvent.press(footer.getByRole('button', { name: 'Load more' }));
  expect(current.loadMore).toHaveBeenCalledTimes(1);
});

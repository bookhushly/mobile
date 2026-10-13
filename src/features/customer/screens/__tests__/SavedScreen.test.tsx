import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { savedDb, type SavedInput, type SavedItem } from '@/features/customer/api/savedDb';
import { NOTICE_MS } from '@/features/customer/hooks/useSavedNotices';
import { SavedScreen } from '@/features/customer/screens/SavedScreen';
import { err, ok } from '@/shared/lib/result';

import { makeQueryClient, NOON, USER, wrapper } from '../../hooks/__tests__/customerTestUtils';

// The real useSaved over a fake saved_listings table: the screen's writes go through the hook's
// queue, rollback and refetch exactly as on a device.
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
const mockNow = NOON;
jest.mock('@/shared/supabase/client', () => ({ supabase: { auth: {} } }));
jest.mock('@/features/customer/api/savedDb', () => ({
  savedDb: { list: jest.fn(), save: jest.fn(), unsave: jest.fn(), isSaved: jest.fn() },
}));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));

const HOTEL: SavedInput = {
  listingId: 'h1',
  kind: 'hotel',
  title: 'Harbour Suites',
  image: 'https://img.example/h1.jpg',
  location: 'Ikeja, Lagos',
};
const APARTMENT: SavedInput = {
  listingId: 'a1',
  kind: 'apartment',
  title: 'Lekki loft',
  image: null,
  location: 'Lekki, Lagos',
};
const EVENT: SavedInput = {
  listingId: 'e1',
  kind: 'event',
  title: 'Afrobeats night',
  image: null,
  location: 'Eko Hotel',
};
const same = (a: SavedInput, b: SavedInput) => a.kind === b.kind && a.listingId === b.listingId;

// The server's rows, newest first.
let rows: SavedItem[];
const row = (s: SavedInput, createdAt: string): SavedItem => ({
  ...s,
  id: `id-${s.listingId}`,
  createdAt,
});

type Db = typeof savedDb;
let list: jest.SpiedFunction<Db['list']>;
let save: jest.SpiedFunction<Db['save']>;
let unsave: jest.SpiedFunction<Db['unsave']>;
let qc: QueryClient;
function props() {
  return {
    userId: USER,
    onOpenListing: jest.fn(),
    onBrowse: jest.fn(),
    onSignInAgain: jest.fn(),
  };
}
async function show(p = props()) {
  await render(<SavedScreen {...p} />, { wrapper: wrapper(qc) });
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading')).toBeNull();
  });
  return p;
}
// Lets the writes, refetches and list batching finish; well short of the banners' timeouts.
async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
  });
}

beforeEach(() => {
  // Fake timers: FlatList's cell-batching timer otherwise fires between act() scopes.
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  qc = makeQueryClient();
  rows = [
    row(HOTEL, '2026-10-12T12:00:00.000Z'),
    row(APARTMENT, '2026-10-12T11:00:00.000Z'),
    row(EVENT, '2026-10-12T10:00:00.000Z'),
  ];
  list = jest.spyOn(savedDb, 'list').mockImplementation(() => Promise.resolve(ok([...rows])));
  save = jest.spyOn(savedDb, 'save').mockImplementation((_u, s) => {
    if (!rows.some((r) => same(r, s))) rows = [row(s, '2026-10-13T11:00:00.000Z'), ...rows];
    return Promise.resolve(ok(undefined));
  });
  unsave = jest.spyOn(savedDb, 'unsave').mockImplementation((_u, k) => {
    rows = rows.filter((r) => !(r.kind === k.kind && r.listingId === k.listingId));
    return Promise.resolve(ok(undefined));
  });
});
afterEach(() => {
  qc.clear();
  jest.useRealTimers();
});

it('shows every saved listing with counted segments, and Stays and Events filter it', async () => {
  const p = await show();
  expect(screen.getByRole('tab', { name: 'All (3)', selected: true })).toBeTruthy();
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.getByText('Lekki loft')).toBeTruthy();
  expect(screen.getByText('Afrobeats night')).toBeTruthy();
  expect(screen.getByTestId('listing-image-h1')).toBeTruthy();

  await fireEvent.press(screen.getByRole('tab', { name: 'Stays (2)' }));
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.getByText('Lekki loft')).toBeTruthy();
  expect(screen.queryByText('Afrobeats night')).toBeNull();

  await fireEvent.press(screen.getByRole('tab', { name: 'Events (1)' }));
  expect(screen.queryByText('Harbour Suites')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Afrobeats night, Eko Hotel' }));
  expect(p.onOpenListing).toHaveBeenCalledWith('event', 'e1');
});

it('the heart unsaves with Undo, and Undo saves the same snapshot again', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Harbour Suites from saved' }));
  expect(screen.queryByText('Harbour Suites')).toBeNull();
  expect(screen.getByRole('tab', { name: 'Stays (1)' })).toBeTruthy();
  expect(screen.getByText('Removed Harbour Suites from saved.')).toBeTruthy();
  expect(unsave).toHaveBeenCalledWith(USER, HOTEL);

  await fireEvent.press(within(screen.getByTestId('saved-undo')).getByRole('button'));
  await settle();
  expect(save).toHaveBeenCalledWith(USER, HOTEL);
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'All (3)' })).toBeTruthy();
  expect(screen.queryByTestId('saved-undo')).toBeNull();
});

it('the Undo banner goes after a while', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Lekki loft from saved' }));
  expect(screen.getByTestId('saved-undo')).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(NOTICE_MS);
  });
  expect(screen.queryByTestId('saved-undo')).toBeNull();
  expect(screen.queryByText('Lekki loft')).toBeNull();
});

// Review Focus 4: Undo's save lands but its response is lost. The app never answers that with
// an unsave (a toggle would): the list refetches and shows the server's truth.
it('a retry after a lost response never unsaves', async () => {
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Harbour Suites from saved' }));
  await settle();
  save.mockImplementationOnce((_u, s) => {
    rows = [row(s, '2026-10-13T11:00:00.000Z'), ...rows];
    return Promise.resolve(err({ kind: 'network' }));
  });
  await fireEvent.press(within(screen.getByTestId('saved-undo')).getByRole('button'));
  await settle();
  expect(screen.getByText('Couldn’t save — check your connection and try again.')).toBeTruthy();
  await waitFor(() => {
    expect(screen.getByText('Harbour Suites')).toBeTruthy();
  });
  expect(unsave).toHaveBeenCalledTimes(1);

  await pullToRefresh();
  await settle();
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.queryByTestId('saved-transient')).toBeNull();
  expect(unsave).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledTimes(1);
});

it('a stale session puts the card back and offers Sign in again', async () => {
  unsave.mockResolvedValueOnce(err({ kind: 'staleSession' }));
  const p = await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Harbour Suites from saved' }));
  await settle();
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.getByText('Couldn’t save. Sign in again if this keeps happening.')).toBeTruthy();
  expect(screen.queryByTestId('saved-undo')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in again' }));
  expect(p.onSignInAgain).toHaveBeenCalled();
});

it('nothing saved: the Marriott empty state with Browse, and no segments', async () => {
  rows = [];
  const p = await show();
  expect(screen.getByText('Nothing saved yet')).toBeTruthy();
  expect(screen.getByText('Tap the heart on anything you like to find it here.')).toBeTruthy();
  expect(screen.queryByTestId('saved-segments')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Browse' }));
  expect(p.onBrowse).toHaveBeenCalled();
});

it('an empty segment says so in one line', async () => {
  rows = [row(EVENT, '2026-10-12T10:00:00.000Z')];
  await show();
  await fireEvent.press(screen.getByRole('tab', { name: 'Stays (0)' }));
  expect(screen.getByText('No saved stays yet.')).toBeTruthy();
});

it('pull to refresh picks up a save from another device', async () => {
  await show();
  rows = [row({ ...HOTEL, listingId: 'h2', title: 'Ocean Bay' }, '2026-10-13T09:00:00.000Z')];
  await pullToRefresh();
  await settle();
  expect(screen.getByText('Ocean Bay')).toBeTruthy();
  expect(screen.queryByText('Lekki loft')).toBeNull();
  expect(screen.getByRole('tab', { name: 'All (1)' })).toBeTruthy();
});

it('a failed load says so and offers Try again', async () => {
  list.mockResolvedValueOnce(err({ kind: 'network' }));
  await show();
  expect(screen.getByText('Couldn’t load your saved list')).toBeTruthy();
  expect(screen.queryByText('Nothing saved yet')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await settle();
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
});

async function pullToRefresh() {
  const control: unknown = screen.getByTestId('saved-list').props.refreshControl;
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

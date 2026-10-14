import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { useRecentSearches } from '@/features/customer/hooks/useRecentSearches';
import type { RecentSearch } from '@/features/customer/offline/recentSearches';
import { SearchScreen } from '@/features/customer/screens/SearchScreen';

// A factory, not an automock: the real module reaches native storage.
jest.mock('@/features/customer/hooks/useRecentSearches', () => ({ useRecentSearches: jest.fn() }));
const mockRecent = jest.mocked(useRecentSearches);

const add = jest.fn<Promise<void>, [RecentSearch]>(() => Promise.resolve());
const remove = jest.fn<Promise<void>, [RecentSearch]>(() => Promise.resolve());
let initial: RecentSearch[];

function useFakeRecent() {
  const [items, setItems] = useState(initial);
  return {
    items,
    add,
    remove: (e: RecentSearch) => {
      setItems(items.filter((x) => x !== e));
      return remove(e);
    },
  };
}

const IKOYI: RecentSearch = { label: 'Ikoyi', category: 'hotels', q: 'Ikoyi' };
const ABUJA_EVENTS: RecentSearch = { label: 'Abuja', category: 'events', state: 'FCT' };

function props() {
  return { userId: 'u1', onBack: jest.fn(), onSearch: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  initial = [IKOYI, ABUJA_EVENTS];
  mockRecent.mockImplementation(useFakeRecent);
});

it('searches only on submit, with sanitised text, and saves it to recent', async () => {
  const p = props();
  await render(<SearchScreen {...p} />);
  const field = screen.getByLabelText('Where or what');
  await fireEvent.changeText(field, 'Lagos, Lekki (Phase 1)');
  // Typing never searches.
  expect(p.onSearch).not.toHaveBeenCalled();
  expect(add).not.toHaveBeenCalled();
  // Review Focus 1: commas and brackets never reach the route.
  await fireEvent(field, 'submitEditing');
  expect(p.onSearch).toHaveBeenCalledWith({ category: 'hotels', q: 'Lagos Lekki Phase 1' });
  expect(add).toHaveBeenCalledWith({
    label: 'Lagos Lekki Phase 1',
    category: 'hotels',
    q: 'Lagos Lekki Phase 1',
  });
});

it('opens with the query to change, from an empty Results list (U7)', async () => {
  const p = props();
  await render(<SearchScreen {...p} initialCategory="events" initialText="Ikeja" />);
  expect(screen.getByLabelText('Where or what')).toHaveDisplayValue('Ikeja');
  await fireEvent(screen.getByLabelText('Where or what'), 'submitEditing');
  expect(p.onSearch).toHaveBeenCalledWith({ category: 'events', q: 'Ikeja' });
});

it('blank or stripped-away text never searches', async () => {
  const p = props();
  await render(<SearchScreen {...p} />);
  const field = screen.getByLabelText('Where or what');
  await fireEvent.changeText(field, ' (,) ');
  await fireEvent(field, 'submitEditing');
  expect(p.onSearch).not.toHaveBeenCalled();
  expect(add).not.toHaveBeenCalled();
});

it('uses the chosen category; the typed row searches too', async () => {
  const p = props();
  await render(<SearchScreen {...p} />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Apartments' }));
  await fireEvent.changeText(screen.getByLabelText('Where or what'), 'Lekki');
  // Recents and popular places step aside while typing.
  expect(screen.queryByText('Recent searches')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Search “Lekki”, Apartments' }));
  expect(p.onSearch).toHaveBeenCalledWith({ category: 'serviced_apartments', q: 'Lekki' });
});

it('an empty field shows recent searches: tap searches again, × removes', async () => {
  const p = props();
  await render(<SearchScreen {...p} />);
  expect(screen.getByText('Recent searches')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Abuja, Events' }));
  expect(p.onSearch).toHaveBeenCalledWith({ category: 'events', region: 'FCT' });
  // Moved to the top of the list.
  expect(add).toHaveBeenCalledWith(ABUJA_EVENTS);

  await fireEvent.press(screen.getByRole('button', { name: 'Remove Ikoyi from recent searches' }));
  expect(remove).toHaveBeenCalledWith(IKOYI);
  expect(screen.queryByRole('button', { name: 'Ikoyi, Hotels' })).toBeNull();
  expect(p.onSearch).toHaveBeenCalledTimes(1);
});

it('popular places search by state or city in the chosen category', async () => {
  initial = [];
  const p = props();
  await render(<SearchScreen {...p} initialCategory="events" />);
  expect(screen.queryByText('Recent searches')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Abuja, Events' }));
  expect(p.onSearch).toHaveBeenLastCalledWith({ category: 'events', region: 'FCT' });
  expect(add).toHaveBeenLastCalledWith({ label: 'Abuja', category: 'events', state: 'FCT' });
  await fireEvent.press(screen.getByRole('button', { name: 'Port Harcourt, Events' }));
  expect(p.onSearch).toHaveBeenLastCalledWith({ category: 'events', city: 'Port Harcourt' });
});

import { focusManager, QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { listingDetailDb } from '@/features/customer/api/listingDetailDb';
import { fetchListings } from '@/features/customer/api/listingsApi';
import { fetchReviews } from '@/features/customer/api/reviewsApi';
import type { Filters } from '@/features/customer/domain/discover';
import { discoverRetry } from '@/features/customer/hooks/discoverRetry';
import { useListing } from '@/features/customer/hooks/useListing';
import {
  LISTINGS_STALE_MS,
  useListings,
  useListingsRail,
  WEEKEND_MAX_PAGES,
} from '@/features/customer/hooks/useListings';
import { useReviews } from '@/features/customer/hooks/useReviews';
import type { EventItem, HotelItem } from '@/features/customer/schemas/listings';
import type { Review } from '@/features/customer/schemas/reviews';
import { shouldRetryQuery } from '@/shared/api/queryClient';
import { err, ok } from '@/shared/lib/result';

import { makeQueryClient, NOON, wrapper } from './customerTestUtils';

jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
let mockNow = 0;
jest.mock('@/features/customer/api/listingsApi', () => ({ fetchListings: jest.fn() }));
jest.mock('@/features/customer/api/reviewsApi', () => ({ fetchReviews: jest.fn() }));
jest.mock('@/features/customer/api/listingDetailDb', () => ({
  listingDetailDb: { hotel: jest.fn(), apartment: jest.fn(), event: jest.fn() },
}));

const listings = jest.mocked(fetchListings);
const reviews = jest.mocked(fetchReviews);
let hotelRead: jest.SpiedFunction<typeof listingDetailDb.hotel>;
let eventRead: jest.SpiedFunction<typeof listingDetailDb.event>;

const NEWEST: Filters = { sort: 'newest' };
const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';

function hotel(id: string): HotelItem {
  return {
    id,
    title: `Hotel ${id}`,
    location: null,
    price: 45000,
    media_urls: null,
    city: 'Ikeja',
    state: 'Lagos',
    avg_rating: null,
    review_count: null,
    breakfast_offered: null,
    generator_available: null,
  };
}

function event(id: string, date: string): EventItem {
  return {
    id,
    title: `Event ${id}`,
    location: null,
    price: 5000,
    media_urls: null,
    vendor_name: null,
    event_date: `${date}T00:00:00`,
    event_time: null,
    low_stock_threshold: null,
  };
}

function review(id: string): Review {
  return {
    id,
    customerName: 'Ada',
    rating: 5,
    comment: 'Lovely',
    verified: true,
    createdAt: null,
    vendorResponse: null,
    vendorResponseDate: null,
  };
}

const params = (call: number) => listings.mock.calls[call]?.[2];

let qc: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  mockNow = NOON; // Tuesday 2026-10-13, 12:00 Lagos
  qc = makeQueryClient();
  hotelRead = jest.spyOn(listingDetailDb, 'hotel');
  eventRead = jest.spyOn(listingDetailDb, 'event');
});
afterEach(() => {
  qc.clear();
});

describe('useListings', () => {
  it('pages through with nextPage (0-based), no user in the call, items flattened', async () => {
    listings
      .mockResolvedValueOnce(ok({ items: [hotel('a'), hotel('b')], nextPage: 1, totalCount: 3 }))
      .mockResolvedValueOnce(ok({ items: [hotel('c')], totalCount: 3 }));
    const { result, unmount } = await renderHook(
      () => useListings('hotels', { q: 'Lekki', state: 'Lagos' }, NEWEST),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });
    expect(listings.mock.calls[0]?.[1]).toBe('hotels');
    expect(params(0)).toEqual({ sort: 'newest', page: '0', search: 'Lekki', state: 'Lagos' });
    expect(listings.mock.calls[0]?.[3]).toBeInstanceOf(AbortSignal);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasMore).toBe(true);
    await act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    });
    expect(params(1)?.page).toBe('1');
    expect(result.current.hasMore).toBe(false);
    // At the end, load more is a no-op.
    await act(() => {
      result.current.loadMore();
    });
    expect(listings).toHaveBeenCalledTimes(2);
    await unmount();
  });

  it('a 429 on load more keeps the shown pages and blocks load more until Retry-After', async () => {
    jest.useFakeTimers();
    listings
      .mockResolvedValueOnce(ok({ items: [hotel('a')], nextPage: 1, totalCount: null }))
      .mockResolvedValueOnce(err({ kind: 'rateLimited', retryAfterSec: 20 }))
      .mockResolvedValueOnce(ok({ items: [hotel('b')], totalCount: null }));
    const { result, unmount } = await renderHook(() => useListings('hotels', { q: '' }, NEWEST), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    await act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.retryAfterSec).toBe(20);
    });
    // Not retried on its own, and the shown items stay.
    expect(listings).toHaveBeenCalledTimes(2);
    expect(result.current.items.map((i) => i.id)).toEqual(['a']);
    expect(result.current.failed).toBe(false);
    expect(result.current.error).toEqual({ kind: 'rateLimited', retryAfterSec: 20 });
    await act(() => {
      result.current.loadMore();
    });
    expect(listings).toHaveBeenCalledTimes(2);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.retryAfterSec).toBeNull();
    await act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b']);
    });
    await unmount();
    jest.useRealTimers();
  });

  it('a first-page failure is failed (nothing to show), not an empty list', async () => {
    listings.mockResolvedValue(err({ kind: 'validation' }));
    const { result, unmount } = await renderHook(() => useListings('events', { q: '' }, NEWEST), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    await unmount();
  });

  it('"This weekend" keeps Fri–Sun events, reads on past empty pages (bounded), hides the count', async () => {
    // Tue 13 Oct: the weekend is Fri 16 – Sun 18.
    listings
      .mockResolvedValueOnce(
        ok({ items: [event('thu', '2026-10-15')], nextPage: 1, totalCount: 40 }),
      )
      .mockResolvedValueOnce(
        ok({
          items: [event('fri', '2026-10-16'), event('wed', '2026-10-14')],
          nextPage: 2,
          totalCount: 40,
        }),
      );
    const { result, unmount } = await renderHook(
      () => useListings('events', { q: '' }, { sort: 'top_rated', eventDate: 'weekend' }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.items.map((i) => i.id)).toEqual(['fri']);
    });
    expect(params(0)?.event_date).toBeUndefined();
    expect([params(0)?.page, params(1)?.page]).toEqual(['0', '1']);
    expect(result.current.totalCount).toBeNull();
    expect(result.current.hasMore).toBe(true);
    await unmount();
  });

  it('"This weekend", soonest first: the list ends once a page reaches past Sunday', async () => {
    listings.mockResolvedValueOnce(
      ok({
        items: [event('sat', '2026-10-17'), event('mon', '2026-10-19')],
        nextPage: 1,
        totalCount: null,
      }),
    );
    const { result, unmount } = await renderHook(
      () => useListings('events', { q: '' }, { sort: 'top_rated', eventDate: 'weekend' }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.items.map((i) => i.id)).toEqual(['sat']);
    });
    expect(result.current.hasMore).toBe(false);
    expect(listings).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('"This weekend", soonest first: an empty page past Sunday ends at once (no read-on)', async () => {
    listings.mockResolvedValueOnce(
      ok({ items: [event('mon', '2026-10-19')], nextPage: 1, totalCount: null }),
    );
    const { result, unmount } = await renderHook(
      () => useListings('events', { q: '' }, { sort: 'top_rated', eventDate: 'weekend' }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(listings).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('"This weekend" stops after a bounded number of empty server pages', async () => {
    // Another sort: dates aren't in order, so a later page can still match.
    listings.mockImplementation((_c, _cat, p) =>
      Promise.resolve(
        ok({
          items: [event(`x${p.page ?? ''}`, '2026-10-21')],
          nextPage: Number(p.page) + 1,
          totalCount: null,
        }),
      ),
    );
    const { result, unmount } = await renderHook(
      () => useListings('events', { q: '' }, { sort: 'newest', eventDate: 'weekend' }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(listings).toHaveBeenCalledTimes(WEEKEND_MAX_PAGES);
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    await unmount();
  });

  it('waits while disabled', async () => {
    const { result, unmount } = await renderHook(
      () => useListings('hotels', { q: '' }, NEWEST, { enabled: false }),
      { wrapper: wrapper(qc) },
    );
    expect(listings).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(false);
    await unmount();
  });
});

describe('discoverRetry (F1)', () => {
  it('a failing rail is read once per client call: the query never retries on top', async () => {
    // The app's own defaults (shouldRetryQuery would retry a network error twice more).
    const appQc = new QueryClient({
      defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0, gcTime: Infinity } },
    });
    listings.mockResolvedValue(err({ kind: 'network' }));
    const { result, unmount } = await renderHook(
      () => useListingsRail('hotels', { q: '' }, NEWEST),
      { wrapper: wrapper(appQc) },
    );
    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(listings).toHaveBeenCalledTimes(1);
    expect(discoverRetry()).toBe(false);
    await unmount();
    appQc.clear();
  });
});

describe('useListingsRail (P1)', () => {
  it('after Results loaded 3 pages, a rail refresh sends one request', async () => {
    listings.mockImplementation((_c, _cat, p) =>
      Promise.resolve(
        ok({
          items: [hotel(`p${p.page ?? ''}`)],
          nextPage: Number(p.page) + 1,
          totalCount: null,
        }),
      ),
    );
    const where = { q: '', state: 'Lagos' };
    const results = await renderHook(() => useListings('hotels', where, NEWEST), {
      wrapper: wrapper(qc),
    });
    for (const n of [1, 2, 3]) {
      await waitFor(() => {
        expect(results.result.current.items).toHaveLength(n);
      });
      if (n < 3)
        await act(() => {
          results.result.current.loadMore();
        });
    }
    expect(listings).toHaveBeenCalledTimes(3);
    const rail = await renderHook(() => useListingsRail('hotels', where, NEWEST), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(rail.result.current.items.map((i) => i.id)).toEqual(['p0']);
    });
    expect(listings).toHaveBeenCalledTimes(4);
    await act(async () => {
      await rail.result.current.refetch();
    });
    expect(listings).toHaveBeenCalledTimes(5);
    expect(params(4)?.page).toBe('0');
    await rail.unmount();
    await results.unmount();
  });

  it('is fresh for 5 minutes and coming back to the app never reloads it', async () => {
    expect(LISTINGS_STALE_MS).toBe(300_000);
    listings.mockResolvedValue(ok({ items: [hotel('a')], totalCount: null }));
    const { result, unmount } = await renderHook(
      () => useListingsRail('hotels', { q: '' }, NEWEST),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    const later = Date.now() + 2 * LISTINGS_STALE_MS;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(later);
    await act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(listings).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
    focusManager.setFocused(undefined);
    await unmount();
  });
});

describe('useListing', () => {
  it('reads the detail for the kind; null when hidden', async () => {
    const detail = { hotel: { id: ID }, roomTypes: [], rates: [] };
    hotelRead.mockResolvedValue(ok(detail as never));
    const { result, unmount } = await renderHook(() => useListing('hotel', ID), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.data).toBe(detail);
    });
    expect(hotelRead).toHaveBeenCalledWith(ID);
    expect(result.current.error).toBe(false);
    await unmount();

    eventRead.mockResolvedValue(ok(null));
    const hidden = await renderHook(() => useListing('event', ID), { wrapper: wrapper(qc) });
    await waitFor(() => {
      expect(hidden.result.current.data).toBeNull();
    });
    await hidden.unmount();
  });

  it('a link that isn’t a UUID is null without a query', async () => {
    const { result, unmount } = await renderHook(() => useListing('event', null), {
      wrapper: wrapper(qc),
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(false);
    expect(eventRead).not.toHaveBeenCalled();
    await unmount();
  });

  it('a failed read is an error, not "not available"', async () => {
    eventRead.mockResolvedValue(err({ kind: 'validation' }));
    const { result, unmount } = await renderHook(() => useListing('event', ID), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.error).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
    await unmount();
  });
});

describe('useReviews', () => {
  it('pages 1-based with the page size, and only when enabled', async () => {
    reviews
      .mockResolvedValueOnce(ok({ reviews: [review('r1')], hasMore: true, total: 2 }))
      .mockResolvedValueOnce(ok({ reviews: [review('r2')], hasMore: false, total: 2 }));
    let enabled = false;
    const { result, rerender, unmount } = await renderHook(
      () => useReviews('apartment', ID, 10, { enabled }),
      { wrapper: wrapper(qc) },
    );
    expect(reviews).not.toHaveBeenCalled();
    enabled = true;
    await rerender({});
    await waitFor(() => {
      expect(result.current.reviews).toHaveLength(1);
    });
    expect(reviews.mock.calls[0]?.slice(1, 5)).toEqual([ID, 'apartment', 1, 10]);
    expect(result.current.total).toBe(2);
    await act(() => {
      result.current.loadMore();
    });
    await waitFor(() => {
      expect(result.current.reviews.map((r) => r.id)).toEqual(['r1', 'r2']);
    });
    expect(reviews.mock.calls[1]?.[3]).toBe(2);
    expect(result.current.hasMore).toBe(false);
    await unmount();
  });

  it('a 429 is not retried and reports Retry-After', async () => {
    reviews.mockResolvedValue(err({ kind: 'rateLimited', retryAfterSec: 30 }));
    const { result, unmount } = await renderHook(() => useReviews('hotel', ID, 3), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(result.current.retryAfterSec).toBe(30);
    expect(reviews).toHaveBeenCalledTimes(1);
    await unmount();
  });
});

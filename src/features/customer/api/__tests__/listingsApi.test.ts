import { fetchListings } from '@/features/customer/api/listingsApi';
import { fetchReviews } from '@/features/customer/api/reviewsApi';
import { createApiClient } from '@/shared/api/client';

type Call = { url: string; init: RequestInit };

function make(body: unknown, status = 200) {
  const calls: Call[] = [];
  const getAccessToken = jest.fn(() => Promise.resolve('secret-token'));
  const refreshSession = jest.fn(() => Promise.resolve({ token: 'tok2' }));
  const fetchFn = jest.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as unknown as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://bookhushly.com',
    fetchFn,
    getAccessToken,
    refreshSession,
    clock: { recordServerDate: () => undefined },
    appVersion: '1.0.0 (1)',
    platform: 'ios',
    sleep: () => Promise.resolve(),
    random: () => 0,
    maxRetries: 0,
  });
  return { client, calls, getAccessToken, refreshSession };
}

const headersOf = (c: Call | undefined) => c?.init.headers as Record<string, string>;

describe('fetchListings', () => {
  it('GETs the public route with the category first and encoded params, without Authorization', async () => {
    const { client, calls, getAccessToken } = make({
      items: [{ id: 'h1', title: 'Eko', price: 0, agent_phone: '0800' }],
      nextPage: 1,
      totalCount: 21,
    });
    const r = await fetchListings(client, 'hotels', {
      sort: 'newest',
      page: '0',
      search: 'Lekki Phase 1',
    });
    expect(calls[0]?.url).toBe(
      'https://bookhushly.com/api/listings?category=hotels&sort=newest&page=0&search=Lekki%20Phase%201',
    );
    expect(calls[0]?.init.method).toBe('GET');
    expect(headersOf(calls[0])).not.toHaveProperty('Authorization');
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(r.ok && r.value.items[0]).toEqual(expect.objectContaining({ id: 'h1', price: 0 }));
    expect(r.ok && r.value.items[0]).not.toHaveProperty('agent_phone');
    expect(r.ok && r.value.nextPage).toBe(1);
    expect(r.ok && r.value.totalCount).toBe(21);
  });

  it('a params category never overrides the argument', async () => {
    const { client, calls } = make({ items: [], totalCount: 0 });
    await fetchListings(client, 'events', { category: 'hotels', sort: 'top_rated', page: '0' });
    expect(calls[0]?.url).toBe(
      'https://bookhushly.com/api/listings?category=events&sort=top_rated&page=0',
    );
  });

  it('parses per category', async () => {
    const { client } = make({
      items: [{ id: 'e1', title: 'Show', price: null, vendor_phone: '0800' }],
      totalCount: null,
    });
    const r = await fetchListings(client, 'events', { sort: 'newest', page: '0' });
    expect(r).toEqual({
      ok: true,
      value: {
        items: [
          {
            id: 'e1',
            title: 'Show',
            location: null,
            price: null,
            media_urls: null,
            vendor_name: null,
            event_date: null,
            event_time: null,
            low_stock_threshold: null,
          },
        ],
        totalCount: null,
      },
    });
  });

  it('a 401 is not refreshed (public route)', async () => {
    const { client, refreshSession } = make({ error: 'x' }, 401);
    const r = await fetchListings(client, 'hotels', { sort: 'newest', page: '0' });
    expect(r).toEqual({ ok: false, error: { kind: 'auth' } });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('a 400 or a bad body is an error, not an empty list', async () => {
    expect((await fetchListings(make({ error: 'x' }, 400).client, 'hotels', {})).ok).toBe(false);
    expect(await fetchListings(make({ nope: 1 }).client, 'hotels', {})).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
  });
});

describe('fetchReviews', () => {
  const body = {
    data: {
      reviews: [
        {
          id: 'r1',
          customer_name: 'Ada',
          rating: 5,
          comment: 'Lovely',
          verified_booking: true,
          created_at: '2026-10-01T10:00:00Z',
          vendor_response: null,
          vendor_response_date: null,
          user_id: 'u1',
        },
      ],
      stats: { average: 5, total: 1, distribution: {} },
      pagination: { page: 1, limit: 3, total: 23, totalPages: 8, hasMore: true },
    },
  };

  it('GETs /api/reviews/{id} with type, page and limit, without Authorization', async () => {
    const { client, calls, getAccessToken } = make(body);
    const r = await fetchReviews(client, 'h/1', 'hotel', 1, 3);
    expect(calls[0]?.url).toBe(
      'https://bookhushly.com/api/reviews/h%2F1?type=hotel&page=1&limit=3',
    );
    expect(headersOf(calls[0])).not.toHaveProperty('Authorization');
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(r).toEqual({
      ok: true,
      value: {
        reviews: [
          {
            id: 'r1',
            customerName: 'Ada',
            rating: 5,
            comment: 'Lovely',
            verified: true,
            createdAt: '2026-10-01T10:00:00Z',
            vendorResponse: null,
            vendorResponseDate: null,
          },
        ],
        hasMore: true,
        total: 23,
      },
    });
  });

  it('never uses the per-page stats, and clamps page and limit to the route’s range', async () => {
    const { client, calls } = make(body);
    await fetchReviews(client, 'a1', 'apartment', 0, 500);
    expect(calls[0]?.url).toBe(
      'https://bookhushly.com/api/reviews/a1?type=apartment&page=1&limit=50',
    );
  });

  it('drops a review that does not parse', async () => {
    const { client } = make({
      data: { ...body.data, reviews: [{ id: 'r2' }, ...body.data.reviews] },
    });
    const r = await fetchReviews(client, 'h1', 'hotel', 1, 10);
    expect(r.ok && r.value.reviews.map((x) => x.id)).toEqual(['r1']);
  });
});

import { fetchReviews, postReview } from '@/features/customer/api/reviewsApi';

import { fakeRequester } from './fakeRequester';

describe('postReview', () => {
  it.each(['hotel', 'apartment', 'event'] as const)(
    'POSTs exactly {listing_type: %s, rating, comment} with Bearer, never idempotent',
    async (type) => {
      const { client, calls } = fakeRequester({ body: { data: { id: 'r1', rating: 4 } } });
      expect(await postReview(client, 'l/1', type, 4, '  Lovely stay, great staff  ')).toEqual({
        ok: true,
        value: { id: 'r1' },
      });
      expect(calls[0]?.path).toBe('/api/reviews/l%2F1');
      expect(calls[0]?.opts.method).toBe('POST');
      expect(calls[0]?.opts.body).toEqual({
        listing_type: type,
        rating: 4,
        comment: 'Lovely stay, great staff',
      });
      expect('auth' in (calls[0]?.opts ?? {})).toBe(false);
      expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
    },
  );

  it.each<[number, string]>([
    [0, 'Lovely stay, great staff'],
    [6, 'Lovely stay, great staff'],
    [3.5, 'Lovely stay, great staff'],
    [4, 'Too short'],
    [4, `  ${'x'.repeat(9)}  `],
    [4, 'x'.repeat(1001)],
  ])('rating %p / an out-of-range comment is never sent', async (rating, comment) => {
    const { client, calls } = fakeRequester({ body: {} });
    expect(await postReview(client, 'l1', 'hotel', rating, comment)).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
    expect(calls).toHaveLength(0);
  });

  it('10 and 1000 characters are allowed', async () => {
    const { client, calls } = fakeRequester({ body: { data: { id: 'r1' } } });
    await postReview(client, 'l1', 'hotel', 5, 'x'.repeat(10));
    await postReview(client, 'l1', 'hotel', 5, 'x'.repeat(1000));
    expect(calls).toHaveLength(2);
  });
});

it('the public GET is unchanged (auth: false)', async () => {
  const { client, calls } = fakeRequester({ error: { kind: 'timeout' } });
  await fetchReviews(client, 'l1', 'hotel', 1, 10);
  expect(calls[0]?.path).toBe('/api/reviews/l1?type=hotel&page=1&limit=10');
  expect(calls[0]?.opts.auth).toBe(false);
});

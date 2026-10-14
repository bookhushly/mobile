import { reviewsBody } from '@/features/customer/schemas/reviews';

const body = (reviews: unknown[]) => ({
  data: { reviews, stats: {}, pagination: { hasMore: false, total: reviews.length } },
});

describe('reviewsBody', () => {
  it('cleans the comment and the host’s reply once, at parse time (P6)', () => {
    const page = reviewsBody.parse(
      body([
        {
          id: 'r1',
          customer_name: 'Ada',
          rating: 5,
          comment: '<p>Lovely&nbsp;stay</p><script>alert(1)</script>',
          verified_booking: true,
          created_at: '2026-10-01T10:00:00Z',
          vendor_response: '  Thanks   Ada  ',
          vendor_response_date: null,
        },
      ]),
    );
    expect(page.reviews[0]?.comment).toBe('Lovely stay');
    expect(page.reviews[0]?.vendorResponse).toBe('Thanks Ada');
  });

  it('blank text is null; one odd review is dropped alone', () => {
    const page = reviewsBody.parse(
      body([
        { id: 'r1', rating: 4, comment: '   ', vendor_response: '<p></p>' },
        { id: 'r2', rating: 9 },
      ]),
    );
    expect(page.reviews).toHaveLength(1);
    expect(page.reviews[0]?.comment).toBeNull();
    expect(page.reviews[0]?.vendorResponse).toBeNull();
  });
});

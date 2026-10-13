import { z } from 'zod';

export type Review = {
  id: string;
  customerName: string | null;
  rating: number;
  comment: string | null;
  verified: boolean;
  createdAt: string | null;
  vendorResponse: string | null;
  vendorResponseDate: string | null;
};
export type ReviewsPage = { reviews: Review[]; hasMore: boolean; total: number };

const text = z.string().nullable().catch(null);

const review = z
  .object({
    id: z.string(),
    customer_name: text,
    rating: z.number().int().min(1).max(5),
    comment: text,
    verified_booking: z.boolean().nullable().catch(null),
    created_at: text,
    vendor_response: text,
    vendor_response_date: text,
  })
  .transform((r): Review => ({
    id: r.id,
    customerName: r.customer_name,
    rating: r.rating,
    comment: r.comment,
    verified: r.verified_booking === true,
    createdAt: r.created_at,
    vendorResponse: r.vendor_response,
    vendorResponseDate: r.vendor_response_date,
  }));

// GET /api/reviews/{id} → { data: { reviews, stats, pagination } }. `stats` covers the current page
// only (§9 Customer 4b (e)), so it is never read: ratings come from the listing row.
export const reviewsBody: z.ZodType<ReviewsPage> = z
  .object({
    data: z.object({
      reviews: z.array(z.unknown()),
      pagination: z.object({ hasMore: z.boolean(), total: z.number().int().nonnegative() }),
    }),
  })
  .transform(({ data }) => ({
    // One odd review must not hide the others.
    reviews: data.reviews.flatMap((r) => {
      const p = review.safeParse(r);
      return p.success ? [p.data] : [];
    }),
    hasMore: data.pagination.hasMore,
    total: data.pagination.total,
  }));

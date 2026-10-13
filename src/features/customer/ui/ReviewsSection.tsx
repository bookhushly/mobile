import { View } from 'react-native';

import type { ReviewKind } from '@/features/customer/api/reviewsApi';
import { useReviews } from '@/features/customer/hooks/useReviews';
import { ReviewList } from '@/features/customer/ui/ReviewList';
import { space } from '@/shared/theme';
import { Button, SectionHeader, Sheet, Spinner, Text, TextLink } from '@/shared/ui';

/** Shown on the listing (D10). */
export const FIRST_REVIEWS = 3;
const PAGE = 10;
const BUSY = 'Lots of people are looking right now. Try again in a moment.';
const FAILED = 'Couldn’t load reviews — check your connection.';

type Loaded = ReturnType<typeof useReviews>;

/** Why reviews are missing, with a way to ask again (it waits out a 429's Retry-After). */
function ReviewsFailed({ r }: { r: Loaded }) {
  const busy = r.retryAfterSec !== null;
  return (
    <View style={{ gap: space.s2 }} testID="reviews-failed">
      <Text variant="bodySm" tone="textSecondary">
        {busy ? BUSY : FAILED}
      </Text>
      <TextLink
        label="Try again"
        disabled={busy}
        onPress={() => {
          void r.refetch();
        }}
      />
    </View>
  );
}

type Props = { kind: ReviewKind; listingId: string; onSeeAll: () => void };

// D10/D16: the first three load with the page (stays only); "See all" opens a paged sheet.
export function ReviewsSection({ kind, listingId, onSeeAll }: Props) {
  const r = useReviews(kind, listingId, FIRST_REVIEWS);
  if (!r.loading && !r.failed && r.reviews.length === 0) return null;
  return (
    <View testID="reviews" style={{ gap: space.s2 }}>
      <SectionHeader label="Reviews" />
      {r.loading ? <Spinner label="Loading reviews" /> : null}
      {r.failed && r.reviews.length === 0 ? <ReviewsFailed r={r} /> : null}
      <ReviewList reviews={r.reviews.slice(0, FIRST_REVIEWS)} />
      {r.total > FIRST_REVIEWS ? (
        <Button
          variant="secondary"
          label={`See all reviews (${String(r.total)})`}
          onPress={onSeeAll}
        />
      ) : null}
    </View>
  );
}

type SheetProps = { kind: ReviewKind; listingId: string; onClose: () => void };

/** Mounted only while open (one Modal at a time); pages 10 at a time on request. */
export function AllReviewsSheet({ kind, listingId, onClose }: SheetProps) {
  const r = useReviews(kind, listingId, PAGE);
  return (
    <Sheet visible title="Reviews" onClose={onClose} scroll testID="all-reviews">
      {r.loading ? <Spinner label="Loading reviews" /> : null}
      <ReviewList reviews={r.reviews} />
      {r.loadingMore ? <Spinner label="Loading more" /> : null}
      {/* After a first page, "Load more" asks again; before it, "Try again". */}
      {r.failed && r.reviews.length === 0 ? <ReviewsFailed r={r} /> : null}
      {r.failed && r.reviews.length > 0 ? (
        <Text variant="bodySm" tone="textSecondary">
          {r.retryAfterSec !== null ? BUSY : FAILED}
        </Text>
      ) : null}
      {r.hasMore && !r.loadingMore ? (
        <Button
          variant="secondary"
          label="Load more reviews"
          disabled={r.retryAfterSec !== null}
          onPress={r.loadMore}
        />
      ) : null}
    </Sheet>
  );
}

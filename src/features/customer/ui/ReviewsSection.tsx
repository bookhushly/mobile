import { FlatList, View } from 'react-native';

import type { useReviews } from '@/features/customer/hooks/useReviews';
import { loadFailedLine } from '@/features/customer/ui/discoverLabels';
import { ReviewItem, ReviewList } from '@/features/customer/ui/ReviewList';
import { space } from '@/shared/theme';
import { Button, SectionHeader, Sheet, Spinner, Text, TextLink } from '@/shared/ui';

/** Shown on the listing (D10). */
export const FIRST_REVIEWS = 3;
/**
 * Perf review P5: one page size for the section and the sheet, so they share one query (the
 * section shows the first three of it; the sheet opens on what's already loaded).
 */
export const REVIEWS_PAGE = 10;
const BUSY = 'Lots of people are looking right now. Try again in a moment.';

export type Loaded = ReturnType<typeof useReviews>;

/** Why reviews are missing, with a way to ask again (it waits out a 429's Retry-After). */
function ReviewsFailed({ r }: { r: Loaded }) {
  const busy = r.retryAfterSec !== null;
  return (
    <View style={{ gap: space.s2 }} testID="reviews-failed">
      <Text variant="bodySm" tone="textSecondary">
        {busy ? BUSY : loadFailedLine(r.error, 'reviews')}
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

type Props = { reviews: Loaded; onSeeAll: () => void };

// D10/D16: the first three show on the page (stays only); "See all" opens a paged sheet. The
// query is the screen's, started with the detail (P5).
export function ReviewsSection({ reviews: r, onSeeAll }: Props) {
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

type SheetProps = { reviews: Loaded; onClose: () => void };

/** Mounted only while open (one Modal at a time); pages 10 at a time on request, virtualised. */
export function AllReviewsSheet({ reviews: r, onClose }: SheetProps) {
  return (
    <Sheet visible title="Reviews" onClose={onClose} testID="all-reviews">
      <FlatList
        testID="all-reviews-list"
        data={r.reviews}
        keyExtractor={(review) => review.id}
        renderItem={({ item }) => <ReviewItem r={item} />}
        initialNumToRender={6}
        windowSize={5}
        ListHeaderComponent={r.loading ? <Spinner label="Loading reviews" /> : null}
        ListFooterComponent={
          <View style={{ gap: space.s3, paddingVertical: space.s4 }}>
            {r.loadingMore ? <Spinner label="Loading more" /> : null}
            {/* After a first page, "Load more" asks again; before it, "Try again". */}
            {r.failed && r.reviews.length === 0 ? <ReviewsFailed r={r} /> : null}
            {r.failed && r.reviews.length > 0 ? (
              <Text variant="bodySm" tone="textSecondary">
                {r.retryAfterSec !== null ? BUSY : loadFailedLine(r.error, 'more reviews')}
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
          </View>
        }
      />
    </Sheet>
  );
}

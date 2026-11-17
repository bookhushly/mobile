import { FlatList, View } from 'react-native';

import type { useReviews } from '@/features/customer/hooks/useReviews';
import { loadFailedLine } from '@/features/customer/ui/discoverLabels';
import { ratingWord } from '@/features/customer/domain/discover';
import { REVIEW_CARD_WIDTH, ReviewCard, ReviewItem } from '@/features/customer/ui/ReviewList';
import { layout, space } from '@/shared/theme';
import { Button, SectionHeader, Sheet, Spinner, Text, TextLink, useWide } from '@/shared/ui';

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

type Props = {
  reviews: Loaded;
  /** The listing's average and count, for the score at the top. */
  rating: { avg: number; count: number } | null;
  onSeeAll: () => void;
};

// D10/D16, laid out after Expedia (owner's pick, 2026-11-15): the score as "4.6/5" with its word
// and count, the first reviews as cards in a row you swipe, and "See all" for the paged sheet.
// The query is the screen's, started with the detail (P5).
export function ReviewsSection({ reviews: r, rating, onSeeAll }: Props) {
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  if (!r.loading && !r.failed && r.reviews.length === 0) return null;
  const word = rating === null ? null : ratingWord(rating.avg, rating.count);
  return (
    <View testID="reviews" style={{ gap: space.s4 }}>
      <SectionHeader label="Reviews" />
      {rating !== null ? (
        <View
          accessible
          accessibilityLabel={`Rated ${rating.avg.toFixed(1)} out of 5${word === null ? '' : `, ${word}`}, ${String(rating.count)} reviews`}
          style={{ gap: space.s1 }}
        >
          <Text variant="display" tabular>
            {`${rating.avg.toFixed(1)}/5`}
          </Text>
          <Text variant="body" tone="textSecondary">
            {[word, `${String(rating.count)} review${rating.count === 1 ? '' : 's'}`]
              .filter((x) => x !== null)
              .join(' · ')}
          </Text>
        </View>
      ) : null}
      {r.loading ? <Spinner label="Loading reviews" /> : null}
      {r.failed && r.reviews.length === 0 ? <ReviewsFailed r={r} /> : null}
      {r.reviews.length > 0 ? (
        <FlatList
          horizontal
          data={r.reviews.slice(0, FIRST_REVIEWS)}
          keyExtractor={(review) => review.id}
          renderItem={({ item }) => <ReviewCard r={item} />}
          showsHorizontalScrollIndicator={false}
          snapToInterval={REVIEW_CARD_WIDTH + space.s4}
          decelerationRate="fast"
          // Full bleed, so the next card peeks at the screen's edge (there's more to swipe).
          style={{ marginHorizontal: -gutter }}
          contentContainerStyle={{ gap: space.s4, paddingHorizontal: gutter }}
        />
      ) : null}
      {r.total > FIRST_REVIEWS ? (
        <Button
          variant="secondary"
          label={`See all ${String(r.total)} reviews`}
          onPress={onSeeAll}
        />
      ) : null}
    </View>
  );
}

/** A failed "Load more": what happened, and Try again (it waits out a 429's Retry-After). */
function PageFailed({ r }: { r: Loaded }) {
  const busy = r.retryAfterSec !== null;
  return (
    <View style={{ gap: space.s2 }} testID="reviews-page-failed">
      <Text variant="bodySm" tone="textSecondary">
        {busy ? BUSY : loadFailedLine(r.error, 'more reviews')}
      </Text>
      <TextLink label="Try again" disabled={busy} onPress={r.loadMore} />
    </View>
  );
}

type SheetProps = { reviews: Loaded; onClose: () => void };

/** Mounted only while open (one Modal at a time); pages 10 at a time on request, virtualised. */
export function AllReviewsSheet({ reviews: r, onClose }: SheetProps) {
  // A failed next page keeps the reviews shown (`failed` is only for nothing to show).
  const pageFailed = r.reviews.length > 0 && r.error !== null && !r.loadingMore;
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
            {pageFailed ? <PageFailed r={r} /> : null}
            {r.hasMore && !r.loadingMore && !pageFailed ? (
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

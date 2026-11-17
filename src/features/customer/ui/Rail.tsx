import { ChevronDown } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';

import type { ListingCardModel } from '@/features/customer/domain/listingCard';
import { loadFailedLine } from '@/features/customer/ui/discoverLabels';
import { ListingCard, RAIL_CARD_WIDTH } from '@/features/customer/ui/ListingCard';
import type { ApiError } from '@/shared/lib/errors';
import { density, skeletonLine, space } from '@/shared/theme';
import { Banner, Icon, Skeleton, Text, TextLink } from '@/shared/ui';

/** A rail shows the first few; See all opens the full list. */
export const RAIL_MAX = 10;

type Props = {
  /** "Hotels"; with `place`, the heading reads "Hotels in Lagos". */
  title: string;
  /** The rail's place, tappable in the heading to change it (final UX review U2). */
  place?: { label: string; onChange: () => void };
  /** The one line shown in the rail's place when it has nothing ("No hotels in Abuja yet"). */
  emptyNote: string;
  items: readonly ListingCardModel[];
  loading: boolean;
  failed: boolean;
  /** The failed load's error (null while paused offline), for the copy (U7). */
  error: ApiError | null;
  /** A 429 is still inside its Retry-After: Try again comes back after it. */
  waiting: boolean;
  onRetry: () => void;
  /** Opens the full list; without it there's no See all (a list that can't be reopened as is). */
  onSeeAll?: () => void;
  isSaved: (l: ListingCardModel) => boolean;
  savedReady: boolean;
  onOpen: (l: ListingCardModel) => void;
  onToggleSaved: (l: ListingCardModel) => void;
  testID?: string;
};

function RailSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading"
      style={{ flexDirection: 'row', gap: space.s5, overflow: 'hidden' }}
    >
      {[0, 1].map((i) => (
        <View key={i} style={{ width: RAIL_CARD_WIDTH, gap: space.s3 }}>
          <Skeleton height={(RAIL_CARD_WIDTH * 3) / 4} radius="r4" />
          <Skeleton height={skeletonLine.title} width="80%" />
          <Skeleton height={skeletonLine.caption} width="50%" />
        </View>
      ))}
    </View>
  );
}

// Spec §3 / §6: a heading, See all, then a horizontal list of cards. Each rail loads, fails and
// retries on its own; an empty rail gives its place to one line.
export function Rail({
  title: what,
  place,
  emptyNote,
  items,
  loading,
  failed,
  error,
  waiting,
  onRetry,
  onSeeAll,
  isSaved,
  savedReady,
  onOpen,
  onToggleSaved,
  testID,
}: Props) {
  const title = place === undefined ? what : `${what} in ${place.label}`;
  const empty = !loading && !failed && items.length === 0;
  return (
    <View testID={testID} style={{ gap: space.s4 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s3,
          minHeight: density.customer.minTarget,
        }}
      >
        {place === undefined ? (
          <Text variant="title" accessibilityRole="header" numberOfLines={2} style={{ flex: 1 }}>
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            <View accessible accessibilityRole="header" accessibilityLabel={title}>
              <Text variant="title" numberOfLines={1}>
                {`${what} in`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${place.label}. Change place`}
              onPress={place.onChange}
              style={({ pressed }) => ({
                flexShrink: 1,
                minHeight: density.customer.minTarget,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.s1,
                paddingLeft: space.s2,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {/* Booking.com / Airbnb: the place in the heading, in ink, underlined, with a
                  chevron that says it opens a choice (owner, 2026-11-15: it replaces the separate
                  "Stays in Lagos" line). */}
              <Text
                variant="title"
                numberOfLines={1}
                style={{ flexShrink: 1, textDecorationLine: 'underline' }}
              >
                {place.label}
              </Text>
              <Icon as={ChevronDown} size="md" />
            </Pressable>
          </View>
        )}
        {empty || onSeeAll === undefined ? null : (
          <TextLink label="See all" accessibilityLabel={`See all, ${title}`} onPress={onSeeAll} />
        )}
      </View>
      {empty ? (
        // The heading stays, so the page keeps its shape; the note takes the cards' place.
        <Text variant="bodySm" tone="textSecondary">
          {emptyNote}
        </Text>
      ) : loading ? (
        <RailSkeleton />
      ) : failed ? (
        <Banner
          tone="neutral"
          message={
            waiting
              ? 'Lots of people are browsing right now. Try again in a few seconds.'
              : loadFailedLine(error)
          }
          action={waiting ? undefined : { label: 'Try again', onPress: onRetry }}
          testID={testID === undefined ? undefined : `${testID}-error`}
        />
      ) : (
        <FlatList
          horizontal
          data={items.slice(0, RAIL_MAX)}
          keyExtractor={(l) => `${l.kind}:${l.id}`}
          showsHorizontalScrollIndicator={false}
          // Perf review P4: two cards fill a phone's width; the rest render as the rail scrolls.
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
          contentContainerStyle={{ gap: space.s5 }}
          accessibilityLabel={title}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              variant="rail"
              saved={isSaved(item)}
              savedReady={savedReady}
              onOpen={onOpen}
              onToggleSaved={onToggleSaved}
            />
          )}
        />
      )}
    </View>
  );
}

import { FlatList, View } from 'react-native';

import type { ListingCardModel } from '@/features/customer/domain/listingCard';
import { ListingCard, RAIL_CARD_WIDTH } from '@/features/customer/ui/ListingCard';
import { space } from '@/shared/theme';
import { Banner, Skeleton, Text, TextLink } from '@/shared/ui';

/** A rail shows the first few; See all opens the full list. */
export const RAIL_MAX = 10;

type Props = {
  title: string;
  /** The one line shown in the rail's place when it has nothing ("No hotels in Abuja yet"). */
  emptyNote: string;
  items: readonly ListingCardModel[];
  loading: boolean;
  failed: boolean;
  /** A 429 is still inside its Retry-After: Try again comes back after it. */
  waiting: boolean;
  onRetry: () => void;
  onSeeAll: () => void;
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
      style={{ flexDirection: 'row', gap: space.s4, overflow: 'hidden' }}
    >
      {[0, 1].map((i) => (
        <View key={i} style={{ width: RAIL_CARD_WIDTH, gap: space.s3 }}>
          <Skeleton height={(RAIL_CARD_WIDTH * 3) / 4} radius="r3" />
          <Skeleton height={16} width="80%" />
          <Skeleton height={12} width="50%" />
        </View>
      ))}
    </View>
  );
}

// Spec §3 / §6: a heading, See all, then a horizontal list of cards. Each rail loads, fails and
// retries on its own; an empty rail gives its place to one line.
export function Rail({
  title,
  emptyNote,
  items,
  loading,
  failed,
  waiting,
  onRetry,
  onSeeAll,
  isSaved,
  savedReady,
  onOpen,
  onToggleSaved,
  testID,
}: Props) {
  if (!loading && !failed && items.length === 0)
    return (
      <Text testID={testID} variant="bodySm" tone="textSecondary">
        {emptyNote}
      </Text>
    );
  return (
    <View testID={testID} style={{ gap: space.s3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <Text variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Text>
        <TextLink label="See all" accessibilityLabel={`See all, ${title}`} onPress={onSeeAll} />
      </View>
      {loading ? (
        <RailSkeleton />
      ) : failed ? (
        <Banner
          tone="neutral"
          message={
            waiting
              ? 'Lots of people are browsing right now. Try again in a few seconds.'
              : 'Couldn’t load — check your connection and try again.'
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
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          contentContainerStyle={{ gap: space.s4 }}
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

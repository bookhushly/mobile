import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import type { SavedItem } from '@/features/customer/api/savedDb';
import type { ListingKind } from '@/features/customer/domain/discover';
import { firstHttpsImage, type ListingCardModel } from '@/features/customer/domain/listingCard';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { useSavedNotices } from '@/features/customer/hooks/useSavedNotices';
import { ListingCard } from '@/features/customer/ui/ListingCard';
import { SavedBanner, savedBannerShown } from '@/features/customer/ui/SavedBanner';
import { space } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  Header,
  refreshColors,
  Screen,
  SegmentedControl,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Segment = 'all' | 'stays' | 'events';

type Props = {
  userId: string;
  onOpenListing: (kind: ListingKind, id: string) => void;
  /** The empty state's one action: back to Explore. */
  onBrowse: () => void;
  /** A stale session on a heart: the route signs out so the customer can sign in again. */
  onSignInAgain: () => void;
};

const keyOf = (kind: string, id: string) => `${kind}:${id}`;
const inSegment = (s: Segment, i: SavedItem) =>
  s === 'all' || (s === 'events' ? i.kind === 'event' : i.kind !== 'event');
const SEGMENT_EMPTY: Record<Segment, string> = {
  all: '',
  stays: 'No saved stays yet.',
  events: 'No saved events yet.',
};

// A saved row holds only the snapshot written with the save (D9): title, image, place. No price
// or rating, which would be stale; the detail screen reads them fresh.
const cardOfSaved = (i: SavedItem): ListingCardModel => ({
  kind: i.kind,
  id: i.listingId,
  title: i.title !== null && i.title.trim() !== '' ? i.title.trim() : null,
  area: i.location,
  image: firstHttpsImage(i.image === null ? null : [i.image]),
  rating: null,
  price: null,
  when: null,
});

// Spec §3 Saved, D9; Mobbin §6 (Viator grid, Agoda counted tabs, Marriott empty state).
export function SavedScreen({ userId, onOpenListing, onBrowse, onSignInAgain }: Props) {
  const saved = useSaved(userId);
  const [segment, setSegment] = useState<Segment>('all');
  const [refreshing, setRefreshing] = useState(false);
  useSavedNotices(saved);

  const { items } = saved;
  const events = items.filter((i) => i.kind === 'event').length;
  const shown = items.filter((i) => inSegment(segment, i));
  const cards = shown.map(cardOfSaved);

  const refresh = () => {
    // A refresh shows the server's truth: an old Undo or error no longer applies.
    saved.dismissUndo();
    saved.clearWriteError();
    setRefreshing(true);
    void Promise.resolve(saved.refetch())
      .catch(() => undefined)
      .finally(() => {
        setRefreshing(false);
      });
  };
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />
  );

  const onToggleSaved = (l: ListingCardModel) => {
    // The stored snapshot, so Undo writes back exactly what was saved.
    const item = items.find((i) => i.kind === l.kind && i.listingId === l.id);
    if (item === undefined) return;
    void saved.toggle({
      listingId: item.listingId,
      kind: item.kind,
      title: item.title,
      image: item.image,
      location: item.location,
    });
  };
  const onOpen = (l: ListingCardModel) => {
    onOpenListing(l.kind, l.id);
  };

  let body;
  if (saved.loading) body = <SkeletonRows count={4} />;
  else if (saved.error && items.length === 0)
    body = (
      <ErrorState
        title="Couldn’t load your saved list"
        message="Check your connection and try again."
        onRetry={() => void saved.refetch()}
        testID="saved-error"
      />
    );
  else
    body = (
      <FlatList
        testID="saved-list"
        data={cards}
        style={{ flex: 1 }}
        numColumns={2}
        keyExtractor={(c) => keyOf(c.kind, c.id)}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
        refreshControl={refreshControl}
        contentContainerStyle={{ gap: space.s5, flexGrow: 1 }}
        ListHeaderComponent={
          items.length === 0 ? null : (
            <SegmentedControl
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'all', label: 'All', count: items.length },
                { value: 'stays', label: 'Stays', count: items.length - events },
                { value: 'events', label: 'Events', count: events },
              ]}
              testID="saved-segments"
            />
          )
        }
        renderItem={({ item, index }) => (
          // Exact halves (an odd last card keeps its width), split by the gap.
          <View
            style={{
              width: '50%',
              paddingRight: index % 2 === 0 ? space.s2 : 0,
              paddingLeft: index % 2 === 0 ? 0 : space.s2,
            }}
          >
            <ListingCard
              listing={item}
              variant="grid"
              saved
              savedReady={saved.ready}
              onOpen={onOpen}
              onToggleSaved={onToggleSaved}
              testID={`saved-${item.id}`}
            />
          </View>
        )}
        ListEmptyComponent={
          items.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Nothing saved yet"
              message="Tap the heart on anything you like to find it here."
              action={{ label: 'Browse', onPress: onBrowse }}
              testID="saved-empty"
            />
          ) : (
            <Text variant="body" tone="textSecondary" testID="saved-segment-empty">
              {SEGMENT_EMPTY[segment]}
            </Text>
          )
        }
      />
    );

  const footer = savedBannerShown(saved) ? (
    <SavedBanner saved={saved} onSignInAgain={onSignInAgain} />
  ) : undefined;
  return (
    <Screen header={<Header title="Saved" />} footer={footer}>
      {body}
    </Screen>
  );
}

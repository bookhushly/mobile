import {
  ArrowDownUp,
  ArrowLeft,
  SearchX,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { filterCount, type Filters, type ListingKind } from '@/features/customer/domain/discover';
import { cardOf, type ListingCardModel } from '@/features/customer/domain/listingCard';
import type { ResultsQuery } from '@/features/customer/domain/routeParams';
import type { ListingsWhere } from '@/features/customer/hooks/customerKeys';
import { useListings } from '@/features/customer/hooks/useListings';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { useSavedNotices } from '@/features/customer/hooks/useSavedNotices';
import {
  CATEGORY_LABEL,
  placeLabel,
  resultCount,
  SORTS,
  sortLabel,
} from '@/features/customer/ui/discoverLabels';
import { FiltersSheet, NO_FILTERS } from '@/features/customer/ui/FiltersSheet';
import { ListingCard } from '@/features/customer/ui/ListingCard';
import { SavedBanner } from '@/features/customer/ui/SavedBanner';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space } from '@/shared/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  ListRow,
  Screen,
  Sheet,
  SkeletonRows,
  Spinner,
  Text,
  useDensity,
} from '@/shared/ui';

type Props = {
  userId: string;
  query: ResultsQuery;
  onBack: () => void;
  onOpenListing: (kind: ListingKind, id: string) => void;
  onSignInAgain: () => void;
};

const BUSY = 'Lots of searches right now. Try again in a moment.';

function Chip({ label, icon, onPress }: { label: string; icon: LucideIcon; onPress: () => void }) {
  const d = useDensity();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: d.minTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s2,
        paddingHorizontal: space.s4,
        borderRadius: radius.r2,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: pressed ? color.wash : color.surface,
      })}
    >
      <Icon as={icon} size="xs" tone="textSecondary" />
      <Text variant="label" numberOfLines={1} maxScale={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

// Spec §3 Results, D2, D8, D16; Mobbin §3 (Booking.com, Tripadvisor, Agoda).
export function ResultsScreen({ userId, query, onBack, onOpenListing, onSignInAgain }: Props) {
  const d = useDensity();
  const cat = query.category;
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const where: ListingsWhere = {
    q: query.q,
    ...(query.state !== undefined ? { state: query.state } : {}),
    ...(query.city !== undefined ? { city: query.city } : {}),
  };
  const list = useListings(cat, where, filters);
  const saved = useSaved(userId);
  useSavedNotices(saved);
  const now = clock.serverNow();
  const n = filterCount(cat, filters);
  const title = [
    CATEGORY_LABEL[cat],
    query.q === '' ? null : `“${query.q}”`,
    placeLabel(query.state, query.city),
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
  const waiting = list.retryAfterSec !== null;
  const cards = list.items.map((i) => cardOf(cat, i, now));

  let body;
  if (list.loading) body = <SkeletonRows count={6} />;
  else if (list.failed)
    body = (
      <ErrorState
        title="Couldn’t load results"
        message={list.error?.kind === 'rateLimited' ? BUSY : 'Check your connection and try again.'}
        {...(waiting ? {} : { onRetry: () => void list.refetch() })}
        testID="results-error"
      />
    );
  else {
    // A failed (or empty, client-filtered) page keeps what is shown and offers "Load more".
    const offerMore =
      list.hasMore && !list.loadingMore && (list.error !== null || cards.length === 0);
    body = (
      <FlatList
        testID="results-list"
        data={cards}
        style={{ flex: 1 }}
        keyExtractor={(c: ListingCardModel) => `${c.kind}:${c.id}`}
        initialNumToRender={8}
        windowSize={5}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          // After a failure the customer asks again ("Load more"): no automatic retry loop.
          if (list.error === null) list.loadMore();
        }}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            variant="row"
            saved={saved.isSaved(item.kind, item.id)}
            savedReady={saved.ready}
            onOpen={(l) => {
              onOpenListing(l.kind, l.id);
            }}
            onToggleSaved={(l) => {
              void saved.toggle({
                listingId: l.id,
                kind: l.kind,
                title: l.title,
                image: l.image,
                location: l.area,
              });
            }}
            testID={`result-${item.id}`}
          />
        )}
        ListEmptyComponent={
          list.hasMore ? null : (
            <EmptyState
              icon={SearchX}
              title="No matches"
              message="Try a different place or fewer filters."
              {...(n > 0
                ? {
                    action: {
                      label: 'Clear filters',
                      onPress: () => {
                        setFilters(NO_FILTERS);
                      },
                    },
                  }
                : {})}
              testID="results-empty"
            />
          )
        }
        ListFooterComponent={
          list.loadingMore ? (
            <View style={{ paddingVertical: space.s5 }}>
              <Spinner label="Loading more" />
            </View>
          ) : offerMore ? (
            <View style={{ paddingVertical: space.s5, gap: space.s3 }} testID="load-more">
              {list.error !== null ? (
                <Text variant="bodySm" tone="textSecondary" align="center">
                  {list.error.kind === 'rateLimited'
                    ? BUSY
                    : 'Couldn’t load more — check your connection.'}
                </Text>
              ) : null}
              <Button
                variant="secondary"
                label="Load more"
                disabled={waiting}
                onPress={list.loadMore}
              />
            </View>
          ) : null
        }
      />
    );
  }

  const banner = (
    <SavedBanner
      saved={saved}
      onSignInAgain={onSignInAgain}
      loadErrorMessage="Couldn’t load your saved list — saving is off for now."
    />
  );
  return (
    <Screen
      header={
        <Header
          title={title}
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
    >
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: d.targetGap }}
      >
        <Chip
          label={`Sort: ${sortLabel(cat, filters.sort)}`}
          icon={ArrowDownUp}
          onPress={() => {
            setSortOpen(true);
          }}
        />
        <Chip
          label={n > 0 ? `Filters (${String(n)})` : 'Filters'}
          icon={SlidersHorizontal}
          onPress={() => {
            setFiltersOpen(true);
          }}
        />
        {list.totalCount !== null && !list.failed ? (
          <Text variant="bodySm" tone="textSecondary" tabular testID="results-count">
            {resultCount(list.totalCount)}
          </Text>
        ) : null}
      </View>
      {body}
      {banner}
      <Sheet
        visible={sortOpen}
        title="Sort by"
        onClose={() => {
          setSortOpen(false);
        }}
        testID="sort-sheet"
      >
        <View accessibilityRole="radiogroup" accessibilityLabel="Sort by">
          {SORTS.map((s) => (
            <ListRow
              key={s}
              title={sortLabel(cat, s)}
              checked={filters.sort === s}
              onPress={() => {
                setFilters({ ...filters, sort: s });
                setSortOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
      <FiltersSheet
        visible={filtersOpen}
        category={cat}
        value={filters}
        today={lagosToday(now)}
        onApply={(f) => {
          setFilters(f);
          setFiltersOpen(false);
        }}
        onClose={() => {
          setFiltersOpen(false);
        }}
      />
    </Screen>
  );
}

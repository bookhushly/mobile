import { ArrowDownUp, ArrowLeft, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  filterCount,
  type Category,
  type Filters,
  type ListingKind,
} from '@/features/customer/domain/discover';
import { cardOf, minuteOf, type ListingCardModel } from '@/features/customer/domain/listingCard';
import { withoutFilter } from '@/features/customer/domain/nearMatches';
import type { ResultsQuery } from '@/features/customer/domain/routeParams';
import type { ListingsWhere } from '@/features/customer/hooks/customerKeys';
import { useListings } from '@/features/customer/hooks/useListings';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { useSavedNotices } from '@/features/customer/hooks/useSavedNotices';
import {
  CATEGORY_LABEL,
  loadFailedMessage,
  placeLabel,
  resultCount,
  sortLabel,
} from '@/features/customer/ui/discoverLabels';
import { NO_FILTERS } from '@/features/customer/ui/filterOptions';
import { FiltersSheet } from '@/features/customer/ui/FiltersSheet';
import { ListingCard } from '@/features/customer/ui/ListingCard';
import { BUSY, LoadMoreFooter } from '@/features/customer/ui/LoadMoreFooter';
import { NearMatches } from '@/features/customer/ui/NearMatches';
import { SavedBanner } from '@/features/customer/ui/SavedBanner';
import { SortSheet } from '@/features/customer/ui/SortSheet';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { color, elevation, radius, space } from '@/shared/theme';
import {
  ErrorState,
  Icon,
  IconButton,
  PressableScale,
  Screen,
  SkeletonRows,
  Text,
  useDensity,
} from '@/shared/ui';

type Props = {
  userId: string;
  query: ResultsQuery;
  onBack: () => void;
  onOpenListing: (kind: ListingKind, id: string) => void;
  /** Back to Search with this query (the search pill). */
  onChangeSearch: () => void;
  /** Opens another search in full (a "closest matches" rail's See all). */
  onSeeResults: (t: { category: Category; q: string; state?: string; city?: string }) => void;
  onSignInAgain: () => void;
};

// Spec §3 Results, D2, D8, D16. Laid out after Airbnb's search results (owner's pick, 2026-11-15,
// Mobbin "Homes in Menlo Park"): a raised search pill with what was searched and the count, a
// filters button beside it, one big photo card per listing, and Sort as a dark pill floating over
// the list's foot (where Airbnb keeps "Map").
export function ResultsScreen({
  userId,
  query,
  onBack,
  onOpenListing,
  onChangeSearch,
  onSeeResults,
  onSignInAgain,
}: Props) {
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
  const now = minuteOf(clock.serverNow());
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
  // Fewer than this many exact matches, and the closest ones follow under them.
  const FEW = 3;
  const near = (mode: 'none' | 'few') => (
    <NearMatches
      category={cat}
      where={where}
      filters={filters}
      placeName={placeLabel(query.state, query.city)}
      mode={mode}
      exclude={new Set(cards.map((c) => `${c.kind}:${c.id}`))}
      nowMs={now}
      onRemoveFilter={(key) => {
        setFilters(withoutFilter(filters, key));
      }}
      isSaved={(l) => saved.isSaved(l.kind, l.id)}
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
      onSeeAll={(m) => {
        onSeeResults({ category: m.category, ...m.where });
      }}
      onChangeSearch={onChangeSearch}
    />
  );

  let body;
  if (list.loading) body = <SkeletonRows count={6} />;
  else if (list.failed)
    body = (
      <ErrorState
        title="Couldn’t load results"
        message={list.error?.kind === 'rateLimited' ? BUSY : loadFailedMessage(list.error)}
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
        showsVerticalScrollIndicator={false}
        // Room under the last card for the floating Sort pill.
        contentContainerStyle={{ paddingBottom: d.minTarget + space.s9 }}
        ItemSeparatorComponent={Gap}
        keyExtractor={(c: ListingCardModel) => `${c.kind}:${c.id}`}
        initialNumToRender={8}
        // Perf review P4: three screens' worth of rows mounted (image-heavy cards).
        windowSize={3}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          // After a failure the customer asks again ("Load more"): no automatic retry loop.
          if (list.error === null) list.loadMore();
        }}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            variant="feature"
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
        // Never a dead end (owner, 2026-11-15): say so, then the closest matches.
        ListEmptyComponent={list.hasMore ? null : near('none')}
        ListFooterComponent={
          <>
            <LoadMoreFooter
              loadingMore={list.loadingMore}
              offer={offerMore}
              error={list.error}
              waiting={waiting}
              nothingYet={cards.length === 0}
              onLoadMore={list.loadMore}
            />
            {!list.hasMore && cards.length > 0 && cards.length < FEW ? (
              <View style={{ paddingTop: space.s9 }}>{near('few')}</View>
            ) : null}
          </>
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
  const total = list.failed ? null : list.totalCount;
  const header = (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingBottom: space.s3 }}
    >
      <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${title}${total === null ? '' : `, ${resultCount(total)}`}. Change search`}
        onPress={onChangeSearch}
        style={{ flex: 1 }}
        testID="results-search"
      >
        <View
          style={{
            minHeight: d.minTarget,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: space.s5,
            borderRadius: radius.rFull,
            backgroundColor: color.surface,
            ...elevation.e3,
          }}
        >
          {/* One line: what was searched, then the count in grey. Two stacked lines read as two
              separate things (owner, 2026-11-15). */}
          <Text variant="label" numberOfLines={1} accessibilityRole="header">
            {title}
            {total !== null ? (
              <Text variant="label" tone="textSecondary" tabular testID="results-count">
                {` · ${resultCount(total)}`}
              </Text>
            ) : null}
          </Text>
        </View>
      </PressableScale>
      <View>
        <IconButton
          icon={SlidersHorizontal}
          accessibilityLabel={n > 0 ? `Filters, ${String(n)} on` : 'Filters'}
          onPress={() => {
            setFiltersOpen(true);
          }}
          testID="results-filters"
        />
        {n > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -space.s2,
              right: -space.s2,
              minWidth: space.s6,
              height: space.s6,
              paddingHorizontal: space.s2,
              borderRadius: radius.rFull,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color.inverse,
            }}
          >
            <Text variant="labelSm" tone="onInverse" tabular maxScale={1}>
              {String(n)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
  return (
    <Screen header={header}>
      {body}
      {!list.loading && !list.failed ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: space.s5,
            alignItems: 'center',
          }}
        >
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${sortLabel(cat, filters.sort)}`}
            onPress={() => {
              setSortOpen(true);
            }}
            testID="results-sort"
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.s3,
                minHeight: d.minTarget,
                paddingHorizontal: space.s6,
                borderRadius: radius.rFull,
                backgroundColor: color.inverse,
                ...elevation.e3,
              }}
            >
              <Icon as={ArrowDownUp} size="sm" tone="onInverse" />
              <Text variant="label" tone="onInverse" numberOfLines={1}>
                {`Sort: ${sortLabel(cat, filters.sort)}`}
              </Text>
            </View>
          </PressableScale>
        </View>
      ) : null}
      {banner}
      <SortSheet
        visible={sortOpen}
        category={cat}
        value={filters.sort}
        onChoose={(s) => {
          setFilters({ ...filters, sort: s });
          setSortOpen(false);
        }}
        onClose={() => {
          setSortOpen(false);
        }}
      />
      <FiltersSheet
        visible={filtersOpen}
        category={cat}
        where={where}
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

/** Airbnb leaves a wide gap between big cards, so each reads as its own. */
function Gap() {
  return <View style={{ height: space.s8 }} />;
}

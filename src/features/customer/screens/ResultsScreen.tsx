import { ArrowLeft, SearchX } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList } from 'react-native';

import { filterCount, type Filters, type ListingKind } from '@/features/customer/domain/discover';
import { cardOf, minuteOf, type ListingCardModel } from '@/features/customer/domain/listingCard';
import type { ResultsQuery } from '@/features/customer/domain/routeParams';
import type { ListingsWhere } from '@/features/customer/hooks/customerKeys';
import { useListings } from '@/features/customer/hooks/useListings';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { useSavedNotices } from '@/features/customer/hooks/useSavedNotices';
import {
  CATEGORY_LABEL,
  loadFailedMessage,
  placeLabel,
  sortLabel,
} from '@/features/customer/ui/discoverLabels';
import { NO_FILTERS } from '@/features/customer/ui/filterOptions';
import { FiltersSheet } from '@/features/customer/ui/FiltersSheet';
import { ListingCard } from '@/features/customer/ui/ListingCard';
import { BUSY, LoadMoreFooter } from '@/features/customer/ui/LoadMoreFooter';
import { ResultsBar } from '@/features/customer/ui/ResultsBar';
import { SavedBanner } from '@/features/customer/ui/SavedBanner';
import { SortSheet } from '@/features/customer/ui/SortSheet';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { EmptyState, ErrorState, Header, IconButton, Screen, SkeletonRows } from '@/shared/ui';

type Props = {
  userId: string;
  query: ResultsQuery;
  onBack: () => void;
  onOpenListing: (kind: ListingKind, id: string) => void;
  /** Back to Search with this query (an empty list with no filters, U7). */
  onChangeSearch: () => void;
  onSignInAgain: () => void;
};

// Spec §3 Results, D2, D8, D16; Mobbin §3 (Booking.com, Tripadvisor, Agoda).
export function ResultsScreen({
  userId,
  query,
  onBack,
  onOpenListing,
  onChangeSearch,
  onSignInAgain,
}: Props) {
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
              action={
                n > 0
                  ? {
                      label: 'Clear filters',
                      // The sort stays: it never empties a list.
                      onPress: () => {
                        setFilters({ sort: filters.sort });
                      },
                    }
                  : { label: 'Change search', onPress: onChangeSearch }
              }
              testID="results-empty"
            />
          )
        }
        ListFooterComponent={
          <LoadMoreFooter
            loadingMore={list.loadingMore}
            offer={offerMore}
            error={list.error}
            waiting={waiting}
            nothingYet={cards.length === 0}
            onLoadMore={list.loadMore}
          />
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
      <ResultsBar
        sortLabel={sortLabel(cat, filters.sort)}
        filterCount={n}
        total={list.failed ? null : list.totalCount}
        onSort={() => {
          setSortOpen(true);
        }}
        onFilters={() => {
          setFiltersOpen(true);
        }}
      />
      {body}
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

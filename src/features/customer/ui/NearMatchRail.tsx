import type { ListingCardModel } from '@/features/customer/domain/listingCard';
import type { NearMatch } from '@/features/customer/domain/nearMatches';
import type { NearMatchRow } from '@/features/customer/hooks/useNearMatches';
import { CATEGORY_LABEL } from '@/features/customer/ui/discoverLabels';
import { Rail } from '@/features/customer/ui/Rail';

type Props = {
  row: NearMatchRow;
  /** "Port Harcourt", when the search had a place. */
  placeName: string | null;
  isSaved: (l: ListingCardModel) => boolean;
  savedReady: boolean;
  onOpen: (l: ListingCardModel) => void;
  onToggleSaved: (l: ListingCardModel) => void;
  /** Opens this list in full; absent for one Results can't reopen (filters elsewhere). */
  onSeeAll?: () => void;
  testID?: string;
};

/** The heading says how these differ from what was asked. */
export function nearMatchTitle(m: NearMatch, placeName: string | null): string {
  const kind = CATEGORY_LABEL[m.category];
  switch (m.reason) {
    case 'samePlaceNoFilters':
      return placeName === null ? 'Without your filters' : `In ${placeName}, without your filters`;
    case 'filtersElsewhere':
      return `${kind} with your filters, in other places`;
    case 'otherKind':
      return placeName === null ? kind : `${kind} in ${placeName}`;
    case 'anywhere':
      return placeName === null ? `Other ${kind.toLowerCase()}` : `${kind} in other places`;
  }
}

/** One loosened search as an Explore rail: shown only once it has cards (the parent decides). */
export function NearMatchRail({
  row,
  placeName,
  isSaved,
  savedReady,
  onOpen,
  onToggleSaved,
  onSeeAll,
  testID,
}: Props) {
  if (row.failed || (!row.loading && row.cards.length === 0)) return null;
  return (
    <Rail
      title={nearMatchTitle(row.match, placeName)}
      emptyNote=""
      items={row.cards}
      loading={row.loading}
      failed={false}
      error={null}
      waiting={false}
      onRetry={() => undefined}
      {...(onSeeAll !== undefined ? { onSeeAll } : {})}
      isSaved={isSaved}
      savedReady={savedReady}
      onOpen={onOpen}
      onToggleSaved={onToggleSaved}
      testID={testID}
    />
  );
}

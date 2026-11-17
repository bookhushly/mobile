import { View } from 'react-native';

import type { Category, Filters } from '@/features/customer/domain/discover';
import type { ListingCardModel } from '@/features/customer/domain/listingCard';
import {
  activeFilters,
  type FilterKey,
  type NearMatch,
  type Where,
} from '@/features/customer/domain/nearMatches';
import { useNearMatches } from '@/features/customer/hooks/useNearMatches';
import { CATEGORY_LABEL } from '@/features/customer/ui/discoverLabels';
import { NearMatchRail } from '@/features/customer/ui/NearMatchRail';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Banner, Button, PressableScale, Text, useDensity } from '@/shared/ui';

type Props = {
  category: Category;
  where: Where;
  filters: Filters;
  placeName: string | null;
  /** `none`: nothing matched exactly. `few`: a short exact list sits above. */
  mode: 'none' | 'few';
  /** Listings already shown above, never offered twice. */
  exclude: ReadonlySet<string>;
  nowMs: number;
  onRemoveFilter: (key: FilterKey) => void;
  isSaved: (l: ListingCardModel) => boolean;
  savedReady: boolean;
  onOpen: (l: ListingCardModel) => void;
  onToggleSaved: (l: ListingCardModel) => void;
  /** Opens a loosened search in full (one Results can show: no filters carried). */
  onSeeAll: (m: NearMatch) => void;
  /** The way out when nothing close turned up either. */
  onChangeSearch: () => void;
};

/** Why nothing matched, then (only once it's true) that the closest follow. */
function noteFor(p: Props, filtered: boolean, found: boolean): string {
  const kind = CATEGORY_LABEL[p.category].toLowerCase();
  const tail = found ? ' Here’s what’s closest.' : '';
  if (filtered)
    return p.placeName === null
      ? `Nothing matches all your filters yet.${tail}`
      : `Nothing in ${p.placeName} matches all your filters yet.${tail}`;
  if (p.placeName !== null) return `No ${kind} in ${p.placeName} yet.${tail}`;
  if (p.where.q !== '') return `No ${kind} match “${p.where.q}” yet.${tail}`;
  return `No ${kind} yet.${found ? ' Here’s what else is on.' : ''}`;
}

/**
 * Results never ends in a dead end (owner, 2026-11-15): when nothing matches exactly it says so in
 * one line, offers each filter as a one-tap "Remove …" (Airbnb), and shows the closest listings
 * as rails, each headed with how it differs (Nike: "No experiences in Singapore"). Under a short
 * exact list the same rails follow as "Close to what you asked".
 */
export function NearMatches(p: Props) {
  const d = useDensity();
  const active = activeFilters(p.category, p.filters);
  const near = useNearMatches(p.category, p.where, p.filters, p.exclude, p.nowMs, true);
  // A short exact list sits above: only lead into the extras once there are some.
  if (p.mode === 'few' && !near.found) return null;
  return (
    <View style={{ gap: space.s5 }} testID="near-matches">
      {p.mode === 'none' ? (
        <View style={{ gap: space.s4 }}>
          <View
            style={{
              gap: space.s1,
              padding: space.s5,
              borderRadius: radius.r4,
              backgroundColor: color.canvas,
            }}
          >
            <Text variant="bodyStrong" accessibilityRole="header">
              No exact matches
            </Text>
            <Text variant="bodySm" tone="textSecondary">
              {noteFor(p, active.length > 0, near.found)}
            </Text>
          </View>
          {active.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
              {active.map((a) => (
                <PressableScale
                  key={a.key}
                  accessibilityRole="button"
                  // Starts with the words shown, so "Remove Wi-Fi" works by voice (WCAG 2.5.3).
                  accessibilityLabel={`Remove ${a.label}, filter`}
                  onPress={() => {
                    p.onRemoveFilter(a.key);
                  }}
                >
                  <View
                    style={{
                      minHeight: d.minTarget,
                      justifyContent: 'center',
                      paddingHorizontal: space.s4,
                      borderRadius: radius.rFull,
                      borderWidth: borderWidth.hairline,
                      borderColor: color.borderStrong,
                    }}
                  >
                    <Text variant="labelSm">{`Remove “${a.label}”`}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          ) : null}
          {near.failed ? (
            // Never pass a failed load off as "nothing close" (CLAUDE.md: transient ≠ refusal).
            <Banner
              tone="neutral"
              message="Couldn’t load what’s closest. Check your connection and try again."
              action={{ label: 'Try again', onPress: near.retry }}
              testID="near-failed"
            />
          ) : near.settled && !near.found && active.length === 0 ? (
            // Nothing close either: the one way out.
            <Button variant="secondary" label="Change search" onPress={p.onChangeSearch} />
          ) : null}
        </View>
      ) : (
        <Text variant="title" accessibilityRole="header">
          Close to what you asked
        </Text>
      )}
      {/* The rails keep Explore's spacing between sections; the lead-in sits closer to them. */}
      <View style={{ gap: space.s8 }}>
        {near.rows.map((row) => (
          <NearMatchRail
            key={`${row.match.reason}:${row.match.category}`}
            row={row}
            placeName={p.placeName}
            isSaved={p.isSaved}
            savedReady={p.savedReady}
            onOpen={p.onOpen}
            onToggleSaved={p.onToggleSaved}
            {...(row.match.reason === 'filtersElsewhere'
              ? {}
              : {
                  onSeeAll: () => {
                    p.onSeeAll(row.match);
                  },
                })}
            testID={`near-${row.match.reason}-${row.match.category}`}
          />
        ))}
      </View>
    </View>
  );
}

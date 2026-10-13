import { BedDouble, Building2, MapPin, Search, Ticket, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import type { Category, Filters, ListingKind, Place } from '@/features/customer/domain/discover';
import { cardOf, type ListingCardModel } from '@/features/customer/domain/listingCard';
import { todayBanner } from '@/features/customer/domain/todayBanner';
import type { ListingsWhere } from '@/features/customer/hooks/customerKeys';
import { useExplorePlace } from '@/features/customer/hooks/useExplorePlace';
import { useListings } from '@/features/customer/hooks/useListings';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { PlaceSheet } from '@/features/customer/ui/PlaceSheet';
import { Rail } from '@/features/customer/ui/Rail';
import { TodayBanner } from '@/features/customer/ui/TodayBanner';
import { clock } from '@/shared/api/instance';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Banner, Header, Icon, Screen, Text, useDensity } from '@/shared/ui';

export type ResultsTarget = { category: Category; region?: string; city?: string };

type Props = {
  userId: string;
  onOpenSearch: () => void;
  onOpenResults: (t: ResultsTarget) => void;
  onOpenListing: (kind: ListingKind, id: string) => void;
  onShowTickets: (bookingId: string) => void;
  onShowCheckInCode: (bookingId: string) => void;
  /** A stale session on a heart: the route signs out so the customer can sign in again. */
  onSignInAgain: () => void;
};

const CATEGORIES: readonly { cat: Category; label: string; icon: LucideIcon }[] = [
  { cat: 'hotels', label: 'Hotels', icon: BedDouble },
  { cat: 'serviced_apartments', label: 'Apartments', icon: Building2 },
  { cat: 'events', label: 'Events', icon: Ticket },
];

// D6: "Happening soon" is events soonest first; stays are newest in the chosen place.
const SOONEST: Filters = { sort: 'top_rated' };
const NEWEST: Filters = { sort: 'newest' };
const ANYWHERE: ListingsWhere = { q: '' };

const whereOf = (p: Place | null): ListingsWhere => ({
  q: '',
  ...(p?.state !== undefined ? { state: p.state } : {}),
  ...(p?.city !== undefined ? { city: p.city } : {}),
});
const targetOf = (category: Category, p: Place | null): ResultsTarget => ({
  category,
  ...(p?.state !== undefined ? { region: p.state } : {}),
  ...(p?.city !== undefined ? { city: p.city } : {}),
});

function Chip({
  label,
  icon,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const d = useDensity();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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

// Spec §3 Explore, D1, D6, D9, D14.
export function ExploreScreen({
  userId,
  onOpenSearch,
  onOpenResults,
  onOpenListing,
  onShowTickets,
  onShowCheckInCode,
  onSignInAgain,
}: Props) {
  const d = useDensity();
  const my = useMyBookings(userId);
  const saved = useSaved(userId);
  const { place, setPlace } = useExplorePlace(userId);
  const [choosing, setChoosing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const stays = whereOf(place);
  const events = useListings('events', ANYWHERE, SOONEST);
  const hotels = useListings('hotels', stays, NEWEST, { enabled: place !== null });
  const apartments = useListings('serviced_apartments', stays, NEWEST, {
    enabled: place !== null,
  });

  const now = clock.serverNow();
  const today = my.bookings === null ? null : todayBanner(my.bookings.today, my.rows);
  const where = place?.label ?? '';

  const refresh = () => {
    setRefreshing(true);
    void Promise.allSettled([
      events.refetch(),
      place !== null ? hotels.refetch() : Promise.resolve(),
      place !== null ? apartments.refetch() : Promise.resolve(),
      my.refetch(),
      saved.refetch(),
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  const railProps = {
    isSaved: (l: ListingCardModel) => saved.isSaved(l.kind, l.id),
    savedReady: saved.ready,
    onOpen: (l: ListingCardModel) => {
      onOpenListing(l.kind, l.id);
    },
    onToggleSaved: (l: ListingCardModel) => {
      void saved.toggle({
        listingId: l.id,
        kind: l.kind,
        title: l.title,
        image: l.image,
        location: l.area,
      });
    },
  };

  let footer = null;
  if (saved.writeError === 'stale')
    footer = (
      <Banner
        tone="neutral"
        message="Couldn’t save. Sign in again if this keeps happening."
        action={{ label: 'Sign in again', onPress: onSignInAgain }}
        testID="saved-stale"
      />
    );
  else if (saved.writeError === 'transient')
    footer = (
      <Banner
        tone="neutral"
        message="Couldn’t save — check your connection and try again."
        testID="saved-transient"
      />
    );
  else if (saved.lastRemoved !== null)
    footer = (
      <Banner
        tone="neutral"
        message={`Removed ${saved.lastRemoved.title ?? 'listing'} from saved.`}
        action={{
          label: 'Undo',
          onPress: () => {
            void saved.undo();
          },
        }}
        testID="saved-undo"
      />
    );

  return (
    <Screen
      scroll
      header={<Header title="Explore" />}
      footer={footer ?? undefined}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {today !== null ? (
        <TodayBanner
          today={today}
          onShowTickets={onShowTickets}
          onShowCheckInCode={onShowCheckInCode}
          testID="today-banner"
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search hotels, apartments and events"
        onPress={onOpenSearch}
        style={({ pressed }) => ({
          minHeight: d.controlHeight,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s3,
          paddingHorizontal: space.s5,
          borderRadius: radius.rFull,
          borderWidth: borderWidth.hairline,
          borderColor: color.borderStrong,
          backgroundColor: pressed ? color.wash : color.surface,
        })}
      >
        <Icon as={Search} size="sm" tone="textSecondary" />
        <Text variant="body" tone="textSecondary" numberOfLines={1}>
          Search hotels, apartments and events
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: d.targetGap }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.cat}
            label={c.label}
            icon={c.icon}
            onPress={() => {
              onOpenResults({ category: c.cat });
            }}
          />
        ))}
      </View>
      <Rail
        title="Happening soon"
        emptyNote="No upcoming events yet."
        items={events.items.map((i) => cardOf('events', i, now))}
        loading={events.loading}
        failed={events.failed}
        waiting={events.retryAfterSec !== null}
        onRetry={() => void events.refetch()}
        onSeeAll={() => {
          onOpenResults({ category: 'events' });
        }}
        testID="rail-events"
        {...railProps}
      />
      <View style={{ alignSelf: 'flex-start' }}>
        <Chip
          label={place === null ? 'Where to?' : `Where to? · ${where}`}
          accessibilityLabel={place === null ? 'Where to?' : `Where to? ${where}. Change place`}
          icon={MapPin}
          onPress={() => {
            setChoosing(true);
          }}
        />
      </View>
      <Rail
        title={place === null ? 'Hotels' : `Hotels in ${where}`}
        emptyNote={`No hotels in ${where} yet.`}
        items={hotels.items.map((i) => cardOf('hotels', i, now))}
        loading={place === null || hotels.loading}
        failed={hotels.failed}
        waiting={hotels.retryAfterSec !== null}
        onRetry={() => void hotels.refetch()}
        onSeeAll={() => {
          onOpenResults(targetOf('hotels', place));
        }}
        testID="rail-hotels"
        {...railProps}
      />
      <Rail
        title={place === null ? 'Apartments' : `Apartments in ${where}`}
        emptyNote={`No apartments in ${where} yet.`}
        items={apartments.items.map((i) => cardOf('serviced_apartments', i, now))}
        loading={place === null || apartments.loading}
        failed={apartments.failed}
        waiting={apartments.retryAfterSec !== null}
        onRetry={() => void apartments.refetch()}
        onSeeAll={() => {
          onOpenResults(targetOf('serviced_apartments', place));
        }}
        testID="rail-apartments"
        {...railProps}
      />
      <PlaceSheet
        visible={choosing}
        current={place}
        onChoose={(p) => {
          setPlace(p);
          setChoosing(false);
        }}
        onClose={() => {
          setChoosing(false);
        }}
      />
    </Screen>
  );
}

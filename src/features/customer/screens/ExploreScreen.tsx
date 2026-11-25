import { Compass, QrCode, Search, Ticket, WifiOff } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import type { Category, Filters, ListingKind, Place } from '@/features/customer/domain/discover';
import { cardOf, minuteOf, type ListingCardModel } from '@/features/customer/domain/listingCard';
import { todayBanner } from '@/features/customer/domain/todayBanner';
import type { ListingsWhere } from '@/features/customer/hooks/customerKeys';
import { useExplorePlace } from '@/features/customer/hooks/useExplorePlace';
import { useListingsRail } from '@/features/customer/hooks/useListings';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { useSavedNotices } from '@/features/customer/hooks/useSavedNotices';
import { CategoryTiles, type Tile } from '@/features/customer/ui/CategoryTiles';
import { CAR_RENTALS_PHOTO } from '@/features/customer/ui/car/carPhotos';
import { SEND_OR_MOVE_PHOTO } from '@/features/customer/ui/logistics/logisticsPhotos';
import { PromoCard } from '@/features/customer/ui/PromoCard';
import { isConnectionFailure } from '@/features/customer/ui/discoverLabels';
import { PlaceSheet } from '@/features/customer/ui/PlaceSheet';
import { Rail, RAIL_MAX } from '@/features/customer/ui/Rail';
import { SavedBanner, savedBannerShown } from '@/features/customer/ui/SavedBanner';
import { TodayBanner } from '@/features/customer/ui/TodayBanner';
import { clock } from '@/shared/api/instance';
import { borderWidth, color, elevation, radius, space } from '@/shared/theme';
import { Banner, EmptyState, Icon, refreshColors, Screen, Text, useDensity } from '@/shared/ui';

export type ResultsTarget = { category: Category; region?: string; city?: string };

type Props = {
  userId: string;
  onOpenSearch: () => void;
  onOpenResults: (t: ResultsTarget) => void;
  onOpenListing: (kind: ListingKind, id: string) => void;
  onShowTickets: (bookingId: string) => void;
  onShowCheckInCode: (bookingId: string) => void;
  onOpenBookings: () => void;
  /** Phase 6: car rentals are asked for, not listed (request-for-quote). */
  onOpenCarRental: () => void;
  /** Phase 6: logistics is asked for too (send, move, cargo). */
  onOpenLogistics: () => void;
  /** A stale session on a heart: the route signs out so the customer can sign in again. */
  onSignInAgain: () => void;
};

// Brand photos (the opening screen's), never listings.
const HOTEL_PHOTO = require('../../../../assets/images/auth/hotel.webp') as number;
const APARTMENT_PHOTO = require('../../../../assets/images/auth/apartment.webp') as number;
const EVENT_PHOTO = require('../../../../assets/images/auth/event.webp') as number;

type Way = Category | 'car_rentals' | 'logistics';

const CATEGORIES: readonly Tile<Way>[] = [
  { key: 'hotels', label: 'Hotels', blurb: 'Rooms & suites', image: HOTEL_PHOTO },
  { key: 'serviced_apartments', label: 'Apartments', blurb: 'Whole homes', image: APARTMENT_PHOTO },
  { key: 'events', label: 'Events', blurb: 'Tickets to shows', image: EVENT_PHOTO },
  {
    key: 'car_rentals',
    label: 'Car rentals',
    blurb: 'With a driver or self-drive',
    image: CAR_RENTALS_PHOTO,
  },
  {
    key: 'logistics',
    label: 'Send or move something',
    blurb: 'Deliveries, packages, moving, cargo',
    image: SEND_OR_MOVE_PHOTO,
    badge: 'New',
  },
];

// D6: "Happening soon" is events soonest first; stays are newest in the chosen place.
const SOONEST: Filters = { sort: 'top_rated' };
const NEWEST: Filters = { sort: 'newest' };
const ANYWHERE: ListingsWhere = { q: '' };
const SAVED_LOAD_ERROR = 'Couldn’t load your saved list — pull to refresh.';

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

// Spec §3 Explore, D1, D6, D9, D14.
export function ExploreScreen({
  userId,
  onOpenSearch,
  onOpenResults,
  onOpenListing,
  onShowTickets,
  onShowCheckInCode,
  onOpenBookings,
  onOpenCarRental,
  onOpenLogistics,
  onSignInAgain,
}: Props) {
  const d = useDensity();
  const my = useMyBookings(userId);
  const saved = useSaved(userId);
  const { place, setPlace } = useExplorePlace(userId);
  const [choosing, setChoosing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const stays = whereOf(place);
  const events = useListingsRail('events', ANYWHERE, SOONEST);
  const hotels = useListingsRail('hotels', stays, NEWEST, { enabled: place !== null });
  const apartments = useListingsRail('serviced_apartments', stays, NEWEST, {
    enabled: place !== null,
  });

  // Minute steps (early-bird prices turn on the clock): the card models below then stay the same
  // object across re-renders (refresh state, the place sheet) and the memoised cards skip work.
  const now = minuteOf(clock.serverNow());
  const today = my.bookings === null ? null : todayBanner(my.bookings.today, my.rows);
  const where = place?.label ?? '';
  const choosePlace = () => {
    setChoosing(true);
  };
  const placeLink = place === null ? undefined : { label: where, onChange: choosePlace };
  useSavedNotices(saved);

  // Review 5 (4): only the first RAIL_MAX of every page become card models, memoised on the
  // query data (the React Compiler can't see that `now` only steps once a minute).
  const eventCards = useMemo(
    () => events.items.slice(0, RAIL_MAX).map((i) => cardOf('events', i, now)),
    [events.items, now],
  );
  const hotelCards = useMemo(
    () => hotels.items.slice(0, RAIL_MAX).map((i) => cardOf('hotels', i, now)),
    [hotels.items, now],
  );
  const apartmentCards = useMemo(
    () => apartments.items.slice(0, RAIL_MAX).map((i) => cardOf('serviced_apartments', i, now)),
    [apartments.items, now],
  );

  // Final review F7: when every rail failed for want of a connection, one calm line (the Today
  // banner and Saved still work from the device) instead of three identical rail errors.
  const rails = place === null ? [events] : [events, hotels, apartments];
  const offline = rails.every((r) => r.failed && isConnectionFailure(r.error));
  // Nothing anywhere (a new region, or a quiet week): one calm empty state, not three bare lines.
  const allEmpty =
    place !== null && rails.every((r) => !r.loading && !r.failed && r.items.length === 0);
  const retryRails = () => {
    for (const r of rails) void r.refetch();
  };

  const refresh = () => {
    // A refresh shows the server's truth: an old Undo or error no longer applies.
    saved.dismissUndo();
    saved.clearWriteError();
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

  // Stable callbacks so the memoised cards don't all redraw on each render.
  const { toggle } = saved;
  const onOpen = useCallback(
    (l: ListingCardModel) => {
      onOpenListing(l.kind, l.id);
    },
    [onOpenListing],
  );
  const onToggleSaved = useCallback(
    (l: ListingCardModel) => {
      void toggle({
        listingId: l.id,
        kind: l.kind,
        title: l.title,
        image: l.image,
        location: l.area,
      });
    },
    [toggle],
  );
  const railProps = {
    isSaved: (l: ListingCardModel) => saved.isSaved(l.kind, l.id),
    savedReady: saved.ready,
    onOpen,
    onToggleSaved,
  };

  const footer = savedBannerShown(saved, SAVED_LOAD_ERROR) ? (
    <SavedBanner saved={saved} onSignInAgain={onSignInAgain} loadErrorMessage={SAVED_LOAD_ERROR} />
  ) : undefined;

  return (
    <Screen
      scroll
      // Viator, Tripadvisor and Hyatt (Mobbin, 2026-11-15): no page title; the search bar is
      // pinned at the top, so it's one tap away however far down the page you are.
      header={
        <View style={{ paddingTop: space.s3, paddingBottom: space.s4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search hotels, apartments and events"
            onPress={onOpenSearch}
            testID="explore-search"
            style={({ pressed }) => ({
              minHeight: d.controlHeight,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.s3,
              paddingHorizontal: space.s5,
              borderRadius: radius.rFull,
              borderWidth: borderWidth.hairline,
              borderColor: color.border,
              backgroundColor: pressed ? color.wash : color.surface,
              ...elevation.e3,
            })}
          >
            <Icon as={Search} size="md" tone="textPrimary" />
            <Text variant="body" tone="textSecondary" numberOfLines={1}>
              Search hotels, apartments and events
            </Text>
          </Pressable>
        </View>
      }
      footer={footer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />
      }
    >
      {/* Spacing (owner, 2026-11-15: "too tight"), after Airbnb and Expedia: the top group (today,
          search, categories) 16 apart; every section after it 40 apart, so each reads on its own. */}
      <View style={{ gap: space.s9 }}>
        <View style={{ gap: space.s5 }}>
          {today !== null ? (
            <TodayBanner
              today={today}
              onShowTickets={onShowTickets}
              onShowCheckInCode={onShowCheckInCode}
              testID="today-banner"
            />
          ) : null}
          <CategoryTiles
            tiles={CATEGORIES}
            onPress={(cat) => {
              if (cat === 'car_rentals') onOpenCarRental();
              else if (cat === 'logistics') onOpenLogistics();
              else onOpenResults({ category: cat });
            }}
            testID="explore-categories"
          />
        </View>
        {offline ? (
          <Banner
            tone="neutral"
            icon={WifiOff}
            message="You’re offline — showing what’s saved."
            action={{ label: 'Try again', onPress: retryRails }}
            testID="explore-offline"
          />
        ) : allEmpty ? (
          <EmptyState
            icon={Compass}
            title={`Nothing listed in ${where} yet`}
            message="New hotels, apartments and events show up here as they’re added."
            action={{ label: 'Try another place', onPress: choosePlace }}
            testID="explore-empty"
          />
        ) : (
          <View style={{ gap: space.s9 }}>
            <Rail
              title="Hotels"
              {...(placeLink === undefined ? {} : { place: placeLink })}
              emptyNote={`No hotels in ${where} yet.`}
              items={hotelCards}
              loading={place === null || hotels.loading}
              failed={hotels.failed}
              error={hotels.error}
              waiting={hotels.retryAfterSec !== null}
              onRetry={() => void hotels.refetch()}
              onSeeAll={() => {
                onOpenResults(targetOf('hotels', place));
              }}
              testID="rail-hotels"
              {...railProps}
            />
            <Rail
              title="Apartments"
              {...(placeLink === undefined ? {} : { place: placeLink })}
              emptyNote={`No apartments in ${where} yet.`}
              items={apartmentCards}
              loading={place === null || apartments.loading}
              failed={apartments.failed}
              error={apartments.error}
              waiting={apartments.retryAfterSec !== null}
              onRetry={() => void apartments.refetch()}
              onSeeAll={() => {
                onOpenResults(targetOf('serviced_apartments', place));
              }}
              testID="rail-apartments"
              {...railProps}
            />
            {/* Stays first (what most people come to book), then the weekend promo leading
                into the events it promises, then the offline note that belongs with tickets. */}
            <PromoCard
              testID="promo-weekend"
              tone="dark"
              icon={Ticket}
              title="Go out this weekend"
              body="Concerts, comedy, food and culture, with tickets straight to the app."
              action="See events"
              onPress={() => {
                onOpenResults({ category: 'events' });
              }}
            />
            <Rail
              title="Happening soon"
              emptyNote="No upcoming events yet."
              items={eventCards}
              loading={events.loading}
              failed={events.failed}
              error={events.error}
              waiting={events.retryAfterSec !== null}
              onRetry={() => void events.refetch()}
              onSeeAll={() => {
                onOpenResults({ category: 'events' });
              }}
              testID="rail-events"
              {...railProps}
            />
            <PromoCard
              testID="promo-offline"
              tone="tint"
              icon={QrCode}
              title="Your tickets work offline"
              body="Your code is saved on your phone, so it opens at the door even without signal."
              action="See your bookings"
              onPress={onOpenBookings}
            />
          </View>
        )}
      </View>
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

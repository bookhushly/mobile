import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useRef, useState } from 'react';
import type { ScrollView } from 'react-native';

import { webListingUrl, type ListingKind } from '@/features/customer/domain/discover';
import { minuteOf } from '@/features/customer/domain/listingCard';
import { useListing } from '@/features/customer/hooks/useListing';
import { useReviews } from '@/features/customer/hooks/useReviews';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { useSavedNotices } from '@/features/customer/hooks/useSavedNotices';
import { useWebNote } from '@/features/customer/hooks/useWebNote';
import { ListingNotFound } from '@/features/customer/screens/ListingNotFound';
import { AmenityLines } from '@/features/customer/ui/AmenityList';
import { ApartmentBody } from '@/features/customer/ui/ApartmentBody';
import { DetailSection } from '@/features/customer/ui/DetailSection';
import { loadFailedMessage } from '@/features/customer/ui/discoverLabels';
import { EventBody } from '@/features/customer/ui/EventBody';
import { Gallery } from '@/features/customer/ui/Gallery';
import { GalleryViewer } from '@/features/customer/ui/GalleryViewer';
import { HotelBody } from '@/features/customer/ui/HotelBody';
import { openWeb } from '@/features/customer/ui/links';
import { ListingActions } from '@/features/customer/ui/ListingActions';
import { ListingFooter, WEB_NOTE } from '@/features/customer/ui/ListingFooter';
import { ListingOverview } from '@/features/customer/ui/ListingOverview';
import { listingSummary } from '@/features/customer/ui/listingSummary';
import { ReadMoreText } from '@/features/customer/ui/ReadMoreText';
import {
  AllReviewsSheet,
  REVIEWS_PAGE,
  ReviewsSection,
} from '@/features/customer/ui/ReviewsSection';
import { SavedBanner, savedBannerShown } from '@/features/customer/ui/SavedBanner';
import { clock } from '@/shared/api/instance';
import {
  CHECKOUT_EVENTS_ENABLED,
  CHECKOUT_PAYMENTS_ENABLED,
  CHECKOUT_STAYS_ENABLED,
} from '@/shared/config/features';
import { Banner, ErrorState, Header, IconButton, Screen, Sheet, SkeletonRows } from '@/shared/ui';

const KIND_WORD: Record<ListingKind, string> = {
  hotel: 'Hotel',
  apartment: 'Apartment',
  event: 'Event',
};

type Props = {
  kind: ListingKind;
  id: string;
  userId: string;
  onBack: () => void;
  onSignInAgain: () => void;
};

// One Modal at a time: the photo viewer, all amenities, or all reviews.
type Open = { to: 'photos'; index: number } | { to: 'amenities' } | { to: 'reviews' } | null;

/**
 * Spec P2: whether this listing books in the app. Each kind needs its switch, and payments, except
 * a free event (every tier ₦0), which needs no payment.
 */
function inApp(kind: ListingKind, free: boolean): boolean {
  if (kind === 'event') return CHECKOUT_EVENTS_ENABLED && (CHECKOUT_PAYMENTS_ENABLED || free);
  return CHECKOUT_STAYS_ENABLED && CHECKOUT_PAYMENTS_ENABLED;
}

// Spec §3 Listing, D4, D5, D10–D14: gallery, overview, the kind's sections, description,
// reviews (stays only), and a sticky footer: in-app checkout behind its switch (P2), else the
// hand-off to bookhushly.com.
export function ListingScreen({ kind, id, userId, onBack, onSignInAgain }: Props) {
  const listing = useListing(kind, id);
  // Perf review P5: reviews start with the detail (the id is already a valid UUID here), one
  // query shared by the section and the sheet. Events have none in 4b.
  const reviews = useReviews(kind === 'apartment' ? 'apartment' : 'hotel', id, REVIEWS_PAGE, {
    enabled: kind !== 'event',
  });
  const saved = useSaved(userId);
  useSavedNotices(saved);
  const note = useWebNote();
  const [open, setOpen] = useState<Open>(null);
  // The one-time sign-in note, shown on the first tap of the hand-off (U1).
  const [noteOpen, setNoteOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const roomsY = useRef<number | null>(null);
  const close = () => {
    setOpen(null);
  };
  // Minute steps: early-bird prices turn on the clock.
  const now = minuteOf(clock.serverNow());
  const data = listing.data;
  if (data === null) return <ListingNotFound onBack={onBack} />;
  const s = data === undefined ? null : listingSummary(data, now);
  const url = webListingUrl(kind, id);
  const header = (
    <Header
      title={KIND_WORD[kind]}
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
      right={
        s === null ? undefined : (
          <ListingActions kind={kind} id={id} summary={s} url={url} saved={saved} />
        )
      }
    />
  );

  if (s === null || data === undefined)
    return (
      <Screen header={header}>
        {listing.error ? (
          <ErrorState
            title="Couldn’t load this listing"
            message={loadFailedMessage(listing.apiError)}
            onRetry={() => {
              void listing.refetch();
            }}
          />
        ) : (
          <SkeletonRows count={4} />
        )}
      </Screen>
    );

  const free = s.price !== null && 'text' in s.price && s.price.text === 'Free';
  // A hotel books per room type: with no rooms to choose, it stays on the hand-off.
  const checkout = inApp(kind, free) && !('hotel' in data && data.roomTypes.length === 0);
  const label = !checkout
    ? s.action.label
    : kind === 'event'
      ? 'Get tickets'
      : kind === 'hotel'
        ? 'Choose a room'
        : 'Book';
  const book = () => {
    if (s.action.blocked !== null) return;
    if (checkout) {
      if (kind === 'hotel') {
        if (roomsY.current !== null) scroll.current?.scrollTo({ y: roomsY.current });
        return;
      }
      router.push({ pathname: '/checkout/[kind]/[listingId]', params: { kind, listingId: id } });
      return;
    }
    if (note.show && !noteOpen) {
      setNoteOpen(true);
      return;
    }
    closeNote();
    openWeb(url);
  };
  function closeNote() {
    setNoteOpen(false);
    if (note.show) note.markSeen();
  }
  const showAmenities = () => {
    setOpen({ to: 'amenities' });
  };
  const stay = kind === 'event' ? null : kind;
  // Final UX review U3: a stay's description comes right after the overview; an event's after
  // its date, venue and tickets.
  const about =
    s.description !== null ? (
      <DetailSection label="About">
        <ReadMoreText text={s.description} testID="description" />
      </DetailSection>
    ) : null;
  // The sign-in note answers the tap just made, so it wins over an older Undo or saved notice
  // (re-review L1); those come back once the note is closed.
  const notice = noteOpen ? (
    <Banner
      tone="info"
      message={WEB_NOTE}
      action={{ label: 'Continue', onPress: book }}
      onDismiss={closeNote}
      testID="web-note"
    />
  ) : savedBannerShown(saved) ? (
    <SavedBanner saved={saved} onSignInAgain={onSignInAgain} />
  ) : null;
  const footer = (
    <ListingFooter
      price={s.price}
      when={s.when}
      label={label}
      blocked={s.action.blocked}
      onBook={book}
      external={!checkout}
      notice={notice}
    />
  );

  return (
    <Screen scroll scrollRef={scroll} header={header} footer={footer}>
      <Gallery
        kind={kind}
        title={s.title}
        images={s.images}
        onOpen={(index) => {
          setOpen({ to: 'photos', index });
        }}
      />
      <ListingOverview summary={s} showArea={kind !== 'event'} />
      {stay !== null ? about : null}
      {'hotel' in data ? (
        <HotelBody
          listing={data}
          onShowAmenities={showAmenities}
          onRoomsAt={(y) => {
            roomsY.current = y;
          }}
        />
      ) : 'apartment' in data ? (
        <ApartmentBody listing={data} onShowAmenities={showAmenities} />
      ) : (
        <EventBody event={data} stock={s.stock ?? 'onSale'} nowMs={now} />
      )}
      {stay === null ? about : null}
      {stay !== null ? (
        <ReviewsSection
          reviews={reviews}
          onSeeAll={() => {
            setOpen({ to: 'reviews' });
          }}
        />
      ) : null}
      {open?.to === 'photos' ? (
        <GalleryViewer title={s.title} images={s.images} startIndex={open.index} onClose={close} />
      ) : null}
      {open?.to === 'amenities' ? (
        <Sheet visible title="All amenities" onClose={close} scroll>
          <AmenityLines items={s.amenities} />
        </Sheet>
      ) : null}
      {open?.to === 'reviews' && stay !== null ? (
        <AllReviewsSheet reviews={reviews} onClose={close} />
      ) : null}
    </Screen>
  );
}

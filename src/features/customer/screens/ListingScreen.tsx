import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';

import { webListingUrl, type ListingKind } from '@/features/customer/domain/discover';
import { useListing } from '@/features/customer/hooks/useListing';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { useSavedNotices } from '@/features/customer/hooks/useSavedNotices';
import { useWebNote } from '@/features/customer/hooks/useWebNote';
import { ListingNotFound } from '@/features/customer/screens/ListingNotFound';
import { AmenityLines } from '@/features/customer/ui/AmenityList';
import { ApartmentBody } from '@/features/customer/ui/ApartmentBody';
import { DetailSection } from '@/features/customer/ui/DetailSection';
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
import { AllReviewsSheet, ReviewsSection } from '@/features/customer/ui/ReviewsSection';
import { SavedBanner, savedBannerShown } from '@/features/customer/ui/SavedBanner';
import { clock } from '@/shared/api/instance';
import { Banner, ErrorState, Header, IconButton, Screen, Sheet, SkeletonRows } from '@/shared/ui';

const KIND_WORD: Record<ListingKind, string> = {
  hotel: 'Hotel',
  apartment: 'Apartment',
  event: 'Event',
};
const MINUTE_MS = 60_000;

type Props = {
  kind: ListingKind;
  id: string;
  userId: string;
  onBack: () => void;
  onSignInAgain: () => void;
};

// One Modal at a time: the photo viewer, all amenities, or all reviews.
type Open = { to: 'photos'; index: number } | { to: 'amenities' } | { to: 'reviews' } | null;

// Spec §3 Listing, D4, D5, D10–D14: gallery, overview, the kind's sections, description,
// reviews (stays only), and a sticky footer handing off to bookhushly.com.
export function ListingScreen({ kind, id, userId, onBack, onSignInAgain }: Props) {
  const listing = useListing(kind, id);
  const saved = useSaved(userId);
  useSavedNotices(saved);
  const note = useWebNote();
  const [open, setOpen] = useState<Open>(null);
  // The one-time sign-in note, shown on the first tap of the hand-off (U1).
  const [noteOpen, setNoteOpen] = useState(false);
  const close = () => {
    setOpen(null);
  };
  // Minute steps: early-bird prices turn on the clock.
  const now = Math.floor(clock.serverNow() / MINUTE_MS) * MINUTE_MS;
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
            message="Check your connection and try again."
            onRetry={() => {
              void listing.refetch();
            }}
          />
        ) : (
          <SkeletonRows count={4} />
        )}
      </Screen>
    );

  const book = () => {
    if (s.action.blocked !== null) return;
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
  const notice = savedBannerShown(saved) ? (
    <SavedBanner saved={saved} onSignInAgain={onSignInAgain} />
  ) : noteOpen ? (
    <Banner
      tone="info"
      message={WEB_NOTE}
      action={{ label: 'Continue', onPress: book }}
      onDismiss={closeNote}
      testID="web-note"
    />
  ) : null;
  const footer = (
    <ListingFooter
      price={s.price}
      when={s.when}
      label={s.action.label}
      blocked={s.action.blocked}
      onBook={book}
      notice={notice}
    />
  );

  return (
    <Screen scroll header={header} footer={footer}>
      <Gallery
        kind={kind}
        title={s.title}
        images={s.images}
        onOpen={(index) => {
          setOpen({ to: 'photos', index });
        }}
      />
      <ListingOverview summary={s} showArea={kind !== 'event'} />
      {'hotel' in data ? (
        <HotelBody listing={data} onShowAmenities={showAmenities} />
      ) : 'apartment' in data ? (
        <ApartmentBody listing={data} onShowAmenities={showAmenities} />
      ) : (
        <EventBody event={data} stock={s.stock ?? 'onSale'} nowMs={now} />
      )}
      {s.description !== null ? (
        <DetailSection label="About">
          <ReadMoreText text={s.description} testID="description" />
        </DetailSection>
      ) : null}
      {stay !== null ? (
        <ReviewsSection
          kind={stay}
          listingId={id}
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
        <AllReviewsSheet kind={stay} listingId={id} onClose={close} />
      ) : null}
    </Screen>
  );
}

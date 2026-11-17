import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';

import type { ListingKind } from '@/features/customer/domain/discover';
import { useListing } from '@/features/customer/hooks/useListing';
import { useProfile } from '@/features/customer/hooks/useProfile';
import { ListingNotFound } from '@/features/customer/screens/ListingNotFound';
import { EventSelect } from '@/features/customer/ui/checkout/EventSelect';
import { StaySelect } from '@/features/customer/ui/checkout/StaySelect';
import { loadFailedMessage } from '@/features/customer/ui/discoverLabels';
import { CHECKOUT_EVENTS_ENABLED, CHECKOUT_STAYS_ENABLED } from '@/shared/config/features';
import { formatNigerianPhone } from '@/shared/lib/phone';
import { minuteOf } from '@/features/customer/domain/listingCard';
import { BookingSummary } from '@/features/customer/ui/BookingSummary';
import { clock } from '@/shared/api/instance';
import { listingSummary } from '@/features/customer/ui/listingSummary';
import { ErrorState, Header, IconButton, Screen, SkeletonRows } from '@/shared/ui';

type Props = {
  kind: ListingKind;
  listingId: string;
  /** Hotels: the room type being booked and the rate the listing showed (P25). */
  roomTypeId: string | null;
  rateId: string | null;
  userId: string;
  /** The signed-in email: the guest email when the profile has none. */
  email: string;
  /** Signed in, but the account may yet be staff: nothing can be booked until this clears. */
  modePending: boolean;
  onBack: () => void;
  onCreated: (bookingId: string, free: boolean) => void;
};

const enabled = (kind: ListingKind) =>
  kind === 'event' ? CHECKOUT_EVENTS_ENABLED : CHECKOUT_STAYS_ENABLED;

// Spec P1, P22: Select, the first checkout step. A kind switched off (P2) is "not available".
export function SelectScreen(props: Props) {
  if (!enabled(props.kind)) return <ListingNotFound onBack={props.onBack} />;
  return <Select {...props} />;
}

function Select({
  kind,
  listingId,
  roomTypeId,
  rateId,
  userId,
  email,
  modePending,
  onBack,
  onCreated,
}: Props) {
  const listing = useListing(kind, listingId);
  const profile = useProfile(userId);
  // Skeleton only until the profile first settles. The form holds the choices and the create
  // guards (idempotency key, an unsettled event): replacing it later, when a sign-in starts the
  // profile read or a failed read refetches (TanStack goes back to pending), would lose them.
  const [settled, setSettled] = useState(userId === '' || !profile.loading);
  if (!settled && !profile.loading) setSettled(true);
  const guestReady = userId !== '' && !profile.loading;
  const data = listing.data;
  const header = (
    <Header
      title={kind === 'event' ? 'Choose tickets' : 'Your stay'}
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );
  if (data === null) return <ListingNotFound onBack={onBack} />;
  // The profile only prefills: a failed read leaves the fields to the user.
  if (data === undefined || !settled) {
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
  }
  // The place card on top (Airbnb, Booking.com): photo, name, and where or when.
  const ls = listingSummary(data, minuteOf(clock.serverNow()));
  const lead = (
    <BookingSummary
      title={ls.title}
      when={(kind === 'event' ? ls.when : ls.area) ?? ''}
      image={ls.images[0] ?? null}
    />
  );
  const p = profile.profile;
  const guest = {
    name: p?.name ?? '',
    email: p !== null && p.email !== '' ? p.email : email,
    phone: p?.phone == null ? '' : formatNigerianPhone(p.phone),
  };

  if ('hotel' in data) {
    const roomType = data.roomTypes.find((r) => r.id === roomTypeId);
    if (roomType === undefined) return <ListingNotFound onBack={onBack} />;
    return (
      <StaySelect
        stay={{ kind: 'hotel', listing: data, roomType }}
        requestedRate={rateId}
        userId={userId}
        guest={guest}
        guestReady={guestReady}
        modePending={modePending}
        header={header}
        lead={lead}
        onCreated={(id) => {
          onCreated(id, false);
        }}
      />
    );
  }
  if ('apartment' in data) {
    return (
      <StaySelect
        stay={{ kind: 'apartment', listing: data }}
        requestedRate={null}
        userId={userId}
        guest={guest}
        guestReady={guestReady}
        modePending={modePending}
        header={header}
        lead={lead}
        onCreated={(id) => {
          onCreated(id, false);
        }}
      />
    );
  }
  return (
    <EventSelect
      event={data}
      userId={userId}
      guest={guest}
      guestReady={guestReady}
      modePending={modePending}
      header={header}
      lead={lead}
      onCreated={onCreated}
      onRefused={() => {
        void listing.refetch();
      }}
    />
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TextInput } from 'react-native';

import type { ApartmentListing, HotelListing } from '@/features/customer/api/listingDetailDb';
import {
  defaultRate,
  nights,
  stayProblems,
  withoutContactProblems,
  type Guest,
  type StaySelection,
  stayExtrasTotal,
} from '@/features/customer/domain/checkout/selection';
import { bedsLine } from '@/features/customer/domain/listingDetail';
import {
  useApartmentExtras,
  useHotelExtras,
  useRoomAvailability,
} from '@/features/customer/hooks/useCheckoutData';
import { useCreateBooking } from '@/features/customer/hooks/useCreateBooking';
import { loadFailed } from '@/features/customer/hooks/loadState';
import { promoFor, usePromo } from '@/features/customer/hooks/usePromo';
import { useRecheckPromoOnSignIn } from '@/features/customer/hooks/useRecheckPromoOnSignIn';
import { useSelectTotal } from '@/features/customer/hooks/useSelectTotal';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import type { RoomType } from '@/features/customer/schemas/listings';
import {
  ExtrasSection,
  extrasPrices,
  stayExtras,
} from '@/features/customer/ui/checkout/ExtrasSection';
import { FormLoading } from '@/features/customer/ui/checkout/FormLoading';
import { GuestFields } from '@/features/customer/ui/checkout/GuestFields';
import { PromoRow } from '@/features/customer/ui/checkout/PromoRow';
import { SelectFooter } from '@/features/customer/ui/checkout/SelectFooter';
import { SignedInNote } from '@/features/customer/ui/checkout/SignedInNote';
import {
  focusFirst,
  guestErrors,
  NO_ROOMS,
  nightsWord,
  stayWords,
} from '@/features/customer/ui/checkout/selectWords';
import { SpecialRequests } from '@/features/customer/ui/checkout/SpecialRequests';
import { StayDates } from '@/features/customer/ui/checkout/StayDates';
import { StayGuests } from '@/features/customer/ui/checkout/StayGuests';
import { StayRoom } from '@/features/customer/ui/checkout/StayRoom';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { formatNaira, Screen } from '@/shared/ui';

export type Stay =
  | { kind: 'hotel'; listing: HotelListing; roomType: RoomType }
  | { kind: 'apartment'; listing: ApartmentListing };

type Props = {
  stay: Stay;
  requestedRate: string | null;
  userId: string;
  guest: Guest;
  /** Signed in and the profile has settled: the contact fields can be shown and filled. */
  guestReady: boolean;
  /** Signed in, but the account may yet be staff: Continue stays off until this clears. */
  modePending: boolean;
  header: ReactNode;
  onCreated: (bookingId: string) => void;
};

// Spec §5 Select (stays): room and bed option, dates, guests, extras, promo (P9, amended 4c.1), the
// guest's details (P16) and, for hotels, special requests. Continue creates the booking (P1), or
// asks for an account first: the details stay hidden until there is one.
export function StaySelect({
  stay,
  requestedRate,
  userId,
  guest,
  guestReady,
  modePending,
  header,
  onCreated,
}: Props) {
  const hotel = stay.kind === 'hotel' ? stay : null;
  const apt = stay.kind === 'apartment' ? stay.listing.apartment : null;
  const id = hotel !== null ? hotel.listing.hotel.id : (apt?.id ?? '');
  const rates = hotel?.listing.rates.filter((r) => r.room_type_id === hotel.roomType.id) ?? [];
  const [sel, setSel] = useState<StaySelection>(() => ({
    checkIn: null,
    checkOut: null,
    adults: 1,
    children: 0,
    rateId:
      hotel === null ? null : (defaultRate(rates, hotel.roomType.id, requestedRate)?.id ?? null),
    breakfast: {},
    airport: { on: false, type: 'pickup', code: null },
    promo: null,
    guest,
    specialRequests: '',
  }));
  const [tried, setTried] = useState(false);
  // Once only: a later profile refetch must not hide the fields or overwrite what was typed. The
  // details are new to the person, so they aren't marked wrong until the next Continue.
  const [guestFilled, setGuestFilled] = useState(guestReady);
  if (guestReady && !guestFilled) {
    setGuestFilled(true);
    setSel((s) => ({ ...s, guest }));
    setTried(false);
  }
  const signedOut = userId === '';
  const showGuest = !signedOut && guestFilled;
  const [startedSignedOut] = useState(signedOut);
  const ask = useSignInPrompt((s) => s.ask);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const hotelExtras = useHotelExtras(hotel !== null ? id : null);
  const aptExtras = useApartmentExtras(hotel === null ? id : null);
  const availability = useRoomAvailability(hotel?.roomType.id ?? null, sel.checkIn, sel.checkOut);
  const create = useCreateBooking(userId, stay.kind, id);
  const promo = usePromo(stay.kind, id);
  const rate = rates.find((r) => r.id === sel.rateId) ?? null;
  const perNight =
    hotel !== null
      ? (rate?.price_per_night ?? hotel.roomType.base_price)
      : (apt?.price_per_night ?? null);
  const n =
    sel.checkIn !== null && sel.checkOut !== null ? nights(sel.checkIn, sel.checkOut) : null;
  const amount = n !== null && perNight !== null && n > 0 ? perNight * n : null;
  useRecheckPromoOnSignIn(userId, promo, amount);
  const preview = promoFor(promo.state, amount);
  // Extras and the refundable deposit are known here; weekend, VAT and vendor discounts are not,
  // so the footer calls the figure an estimate.
  const priced = extrasPrices(hotelExtras.data, aptExtras.data);
  const deposit = apt?.caution_deposit ?? 0;
  const { total, note } = useSelectTotal(
    stay.kind,
    amount === null
      ? null
      : Math.max(0, amount - (preview.promo?.discount ?? 0)) +
          stayExtrasTotal(priced, sel.breakfast, sel.airport) +
          deposit,
  );
  const created = create.created;
  // Hands over once: the parent's callback may change identity on every render.
  const handed = useRef(false);
  useEffect(() => {
    if (created === null || handed.current) return;
    handed.current = true;
    onCreated(created.bookingId);
  }, [created, onCreated]);

  const extrasQuery = hotel !== null ? hotelExtras : aptExtras;
  if (extrasQuery.data === undefined) {
    return (
      <FormLoading
        header={header}
        failed={loadFailed(extrasQuery)}
        title="Couldn’t load booking options"
        onRetry={() => {
          void extrasQuery.refetch();
        }}
      />
    );
  }

  const he = hotelExtras.data;
  const ae = aptExtras.data;
  const extras = stayExtras(hotel !== null ? he : undefined, hotel === null ? ae : undefined);
  const minNights = hotel !== null ? 1 : Math.max(1, ae?.minimumStay ?? apt?.minimum_stay ?? 1);
  const maxGuests = hotel !== null ? hotel.roomType.max_occupancy : (apt?.max_guests ?? null);
  const stale = preview.stale;
  const selection: StaySelection = { ...sel, promo: preview.promo };
  const rules = { minNights, maxGuests };
  const problems = stayProblems(selection, {
    today: lagosToday(clock.serverNow()),
    minNights,
    maxGuests,
    kind: stay.kind,
  });
  const shown = tried ? problems : [];
  const refused = create.state.phase === 'refused' ? create.state : null;
  const fieldWords = (f: 'dates' | 'guests'): string | undefined => {
    const own = f === 'dates' ? ['dates', 'minNights'] : ['maxGuests'];
    const p = shown.find((x) => own.includes(x));
    if (p !== undefined) return stayWords(p, rules);
    return refused?.field !== undefined && own.includes(refused.field) ? refused.words : undefined;
  };
  const noRooms = hotel !== null && availability.data?.available === false;
  const title = hotel !== null ? (hotel.listing.hotel.name ?? '') : (apt?.name ?? '');

  const footer = (
    <SelectFooter
      estimate={
        n === null
          ? 'Add your dates'
          : total === null
            ? nightsWord(n)
            : `${nightsWord(n)} · about ${formatNaira(total)}`
      }
      blocked={noRooms ? NO_ROOMS : null}
      problem={null}
      create={create.state}
      refusalShownAtField={refused?.field !== undefined}
      gettingDetails={
        modePending || (!signedOut && (!showGuest || promo.state.phase === 'checking'))
      }
      chargeNote={note}
      disabled={sel.checkIn === null || sel.checkOut === null || promo.state.phase === 'checking'}
      onContinue={() => {
        setTried(true);
        const stopping = signedOut ? withoutContactProblems(problems) : problems;
        if (stopping.length > 0) {
          focusFirst(stopping, { name: nameRef, email: emailRef, phone: phoneRef }, (p) =>
            stayWords(p, rules),
          );
          return;
        }
        if (signedOut) {
          ask('book');
          return;
        }
        void create.submit(selection, {
          title,
          ...(hotel !== null ? { roomTypeId: hotel.roomType.id } : {}),
        });
      }}
      onCheckAgain={() => {
        void create.checkAgain();
      }}
    />
  );

  return (
    <Screen scroll header={header} footer={footer}>
      {hotel !== null ? (
        <StayRoom
          roomType={hotel.roomType}
          rates={rates}
          rateId={sel.rateId}
          beds={bedsLine(rate?.beds ?? [])}
          onRate={(rateId) => {
            setSel({ ...sel, rateId });
          }}
        />
      ) : null}
      <StayDates
        checkIn={sel.checkIn}
        checkOut={sel.checkOut}
        minNights={minNights}
        error={fieldWords('dates')}
        onDates={(d) => {
          setSel({ ...sel, ...d });
        }}
      />
      <StayGuests
        kind={stay.kind}
        adults={sel.adults}
        kids={sel.children}
        max={maxGuests}
        error={fieldWords('guests')}
        onChange={(adults, kids) => {
          const total = adults + kids;
          const breakfast = Object.fromEntries(
            Object.entries(sel.breakfast).map(([k, v]) => [k, Math.min(v, total)]),
          );
          setSel({ ...sel, adults, children: kids, breakfast });
        }}
      />
      <ExtrasSection
        extras={extras}
        guests={sel.adults + sel.children}
        breakfast={sel.breakfast}
        airport={sel.airport}
        onBreakfast={(breakfast) => {
          setSel({ ...sel, breakfast });
        }}
        onAirport={(airport) => {
          setSel({ ...sel, airport });
        }}
      />
      <PromoRow
        state={promo.state}
        stale={stale}
        amount={amount}
        onApply={(code) => {
          if (amount !== null) void promo.apply(code, amount);
        }}
        onRemove={promo.remove}
      />
      {showGuest && startedSignedOut ? <SignedInNote /> : null}
      {showGuest ? (
        <GuestFields
          guest={sel.guest}
          onChange={(g) => {
            setSel({ ...sel, guest: g });
          }}
          errors={guestErrors(shown)}
          nameRef={nameRef}
          emailRef={emailRef}
          phoneRef={phoneRef}
        />
      ) : null}
      {hotel !== null ? (
        <SpecialRequests
          value={sel.specialRequests}
          onChange={(specialRequests) => {
            setSel({ ...sel, specialRequests });
          }}
        />
      ) : null}
    </Screen>
  );
}

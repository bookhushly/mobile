import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TextInput } from 'react-native';

import type { ApartmentListing, HotelListing } from '@/features/customer/api/listingDetailDb';
import {
  defaultRate,
  nights,
  stayProblems,
  type Guest,
  type StaySelection,
} from '@/features/customer/domain/checkout/selection';
import { bedsLine } from '@/features/customer/domain/listingDetail';
import {
  useApartmentExtras,
  useHotelExtras,
  useRoomAvailability,
} from '@/features/customer/hooks/useCheckoutData';
import { useCreateBooking } from '@/features/customer/hooks/useCreateBooking';
import { loadFailed } from '@/features/customer/hooks/loadState';
import { usePromo } from '@/features/customer/hooks/usePromo';
import type { RoomType } from '@/features/customer/schemas/listings';
import { ExtrasSection, stayExtras } from '@/features/customer/ui/checkout/ExtrasSection';
import { FormLoading } from '@/features/customer/ui/checkout/FormLoading';
import { GuestFields } from '@/features/customer/ui/checkout/GuestFields';
import { PromoRow } from '@/features/customer/ui/checkout/PromoRow';
import { SelectFooter } from '@/features/customer/ui/checkout/SelectFooter';
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
  header: ReactNode;
  onCreated: (bookingId: string) => void;
};

// Spec §5 Select (stays): room and bed option, dates, guests, extras, promo (hotels, P9), the
// guest's details (P16) and, for hotels, special requests. Continue creates the booking (P1).
export function StaySelect({ stay, requestedRate, userId, guest, header, onCreated }: Props) {
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
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const hotelExtras = useHotelExtras(hotel !== null ? id : null);
  const aptExtras = useApartmentExtras(hotel === null ? id : null);
  const availability = useRoomAvailability(hotel?.roomType.id ?? null, sel.checkIn, sel.checkOut);
  const create = useCreateBooking(userId, stay.kind, id);
  const promo = usePromo('hotel', id);
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
  const rate = rates.find((r) => r.id === sel.rateId) ?? null;
  const perNight =
    hotel !== null
      ? (rate?.price_per_night ?? hotel.roomType.base_price)
      : (apt?.price_per_night ?? null);
  const n =
    sel.checkIn !== null && sel.checkOut !== null ? nights(sel.checkIn, sel.checkOut) : null;
  const amount = n !== null && perNight !== null && n > 0 ? perNight * n : null;
  const applied = promo.state.phase === 'applied' ? promo.state.promo : null;
  const stale = applied !== null && applied.forAmount !== amount;
  const selection: StaySelection = {
    ...sel,
    promo:
      hotel !== null && applied !== null && !stale
        ? { codeId: applied.codeId, discount: applied.discount }
        : null,
  };
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
          : amount === null
            ? nightsWord(n)
            : `${nightsWord(n)} · ${formatNaira(amount)}`
      }
      blocked={noRooms ? NO_ROOMS : null}
      problem={null}
      create={create.state}
      refusalShownAtField={refused?.field !== undefined}
      disabled={sel.checkIn === null || sel.checkOut === null}
      onContinue={() => {
        setTried(true);
        if (problems.length > 0) {
          focusFirst(problems, { name: nameRef, email: emailRef, phone: phoneRef }, (p) =>
            stayWords(p, rules),
          );
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
      {hotel !== null ? (
        <PromoRow
          state={promo.state}
          stale={stale}
          amount={amount}
          onApply={(code) => {
            if (amount !== null) void promo.apply(code, amount);
          }}
          onRemove={promo.remove}
        />
      ) : null}
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

import { ticketLines, type EventSelection, type StaySelection } from './selection';

const MAX_ANSWER_LENGTH = 500;

type Body = Record<string, unknown>;

function guestFields(s: StaySelection): Body {
  return {
    guest_name: s.guest.name,
    guest_email: s.guest.email,
    guest_phone: s.guest.phone,
  };
}

function airportFields(s: StaySelection): Body {
  if (!s.airport.on) return { airport_transfer: false };
  const out: Body = { airport_transfer: true, airport_transfer_type: s.airport.type };
  if (s.airport.code !== null) out.airport_code = s.airport.code;
  return out;
}

function requestsField(s: StaySelection): Body {
  const text = s.specialRequests.trim();
  return text === '' ? {} : { special_requests: text };
}

/** Selections only; the server recomputes every price (P9, never trust client money). */
export function hotelBody(roomTypeId: string, hotelId: string, s: StaySelection): Body {
  const out: Body = { room_type_id: roomTypeId, hotel_id: hotelId };
  if (s.rateId !== null) out.rate_id = s.rateId;
  out.check_in_date = s.checkIn;
  out.check_out_date = s.checkOut;
  out.adults = s.adults;
  out.children = s.children;
  const breakfast = Object.entries(s.breakfast)
    .filter(([, quantity]) => quantity > 0)
    .map(([option_id, quantity]) => ({ option_id, quantity }));
  if (breakfast.length > 0) out.breakfast_selections = breakfast;
  Object.assign(out, airportFields(s));
  if (s.promo !== null) out.promo_code_id = s.promo.codeId;
  Object.assign(out, guestFields(s), requestsField(s));
  return out;
}

/** Apartments take no rate, breakfast or promo (P9). */
export function apartmentBody(apartmentId: string, s: StaySelection): Body {
  return {
    apartment_id: apartmentId,
    check_in_date: s.checkIn,
    check_out_date: s.checkOut,
    number_of_guests: s.adults + s.children,
    ...airportFields(s),
    ...guestFields(s),
    ...requestsField(s),
  };
}

export function eventBody(listingId: string, s: EventSelection, free: boolean): Body {
  const answers: Record<string, string> = {};
  for (const [id, raw] of Object.entries(s.answers)) {
    const text = raw.trim();
    if (text !== '') answers[id] = text.slice(0, MAX_ANSWER_LENGTH);
  }
  const out: Body = {
    listing_id: listingId,
    contact_email: s.guest.email,
    contact_phone: s.guest.phone,
  };
  if (free) out.contact_name = s.guest.name;
  out.ticket_details = ticketLines(s.qty);
  if (Object.keys(answers).length > 0) out.custom_answers = answers;
  if (!free && s.promo !== null) out.promo_code_id = s.promo.codeId;
  return out;
}

import { day, minutesFromNow, photo, uid } from '../time';
import { EVENTS, PAST_EVENTS, type Row } from './events';
import { APARTMENTS, HOTELS, ROOM_TYPES } from './stays';

// Sample accounts. Any password signs in; the password "wrong-password" is refused, to show the
// error. Emails end in .test, which can never be a real inbox.
export const ACCOUNTS = {
  customer: { id: uid(1), email: 'customer@sample.test', name: 'Ada Okafor' },
  fresh: { id: uid(2), email: 'new@sample.test', name: 'Tunde Bello' },
  long: {
    id: uid(3),
    email: 'oluwaseun.adebayo-williams.chukwuemeka@a-very-long-company-domain.sample.test',
    name: 'Oluwaseun Adebayo-Williams Chukwuemeka Nwachukwu-Okonkwo',
  },
} as const;

export const USERS: Row[] = [
  {
    id: ACCOUNTS.customer.id,
    email: ACCOUNTS.customer.email,
    name: ACCOUNTS.customer.name,
    role: 'customer',
    phone: '+2348031234567',
    state: 'Lagos',
    address: null,
  },
  {
    id: ACCOUNTS.fresh.id,
    email: ACCOUNTS.fresh.email,
    name: ACCOUNTS.fresh.name,
    role: 'customer',
    phone: null,
    state: null,
    address: null,
  },
  {
    id: ACCOUNTS.long.id,
    email: ACCOUNTS.long.email,
    name: ACCOUNTS.long.name,
    role: 'customer',
    phone: '+2348099999999',
    state: 'FCT',
    address:
      'Flat 14B, Block 7, The Very Long Estate Name Gardens, off Some Extremely Long Road Name, Wuse 2, Abuja',
  },
];

const ev = (id: number) => [...EVENTS, ...PAST_EVENTS].find((e) => e.id === uid(id)) ?? {};
const hotel = (id: number) => HOTELS.find((h) => h.id === uid(id)) ?? {};
const room = (id: number) => ROOM_TYPES.find((r) => r.id === uid(id)) ?? {};
const apt = (id: number) => APARTMENTS.find((a) => a.id === uid(id)) ?? {};

const listingOf = (e: Row) => ({
  id: e.id,
  title: e.title,
  location: e.location,
  media_urls: e.media_urls,
  event_date: e.event_date,
  event_end_date: e.event_end_date,
  event_time: e.event_time,
  require_dynamic_ticket: e.require_dynamic_ticket,
});
const hotelOf = (h: Row) => ({
  id: h.id,
  name: h.name,
  city: h.city,
  state: h.state,
  address: h.address,
  image_urls: h.image_urls,
  check_in_time: h.check_in_time,
  check_out_time: h.check_out_time,
});
const apartmentOf = (a: Row) => ({
  id: a.id,
  name: a.name,
  city: a.city,
  state: a.state,
  area: a.area,
  address: a.address,
  image_urls: a.image_urls,
  check_in_time: a.check_in_time,
  check_out_time: a.check_out_time,
});
const tickets = (bookingId: number, type: string, n: number, usedFirst = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: uid(bookingId * 10 + i),
    ticket_type: type,
    ticket_index: i + 1,
    checked_in_at: i < usedFirst ? minutesFromNow(-90) : null,
  }));

const C = ACCOUNTS.customer.id;

function eventBooking(n: number, event: number, extra: Row): Row {
  const e = ev(event);
  return {
    id: uid(n),
    customer_id: C,
    listing_id: e.id,
    status: 'confirmed',
    payment_status: 'completed',
    total_amount: 30000,
    booking_date: day(-3),
    booking_time: '10:00:00',
    guests: 2,
    ticket_details: { Regular: 2 },
    seat_assignments: null,
    created_at: minutesFromNow(-60 * 24 * 3),
    listing: listingOf(e),
    tickets: tickets(n, 'Regular', 2),
    ...extra,
  };
}

// Customer's event bookings: tonight (Today banner, live codes), upcoming with three tickets,
// one ticket already used, a free one, pending payment, cancelled, refunded, and a past one.
export const EVENT_BOOKINGS: Row[] = [
  eventBooking(5001, 1007, {
    total_amount: 6000,
    ticket_details: { General: 2 },
    tickets: tickets(5001, 'General', 2),
  }),
  eventBooking(5002, 1001, {
    total_amount: 90000,
    guests: 3,
    ticket_details: { Regular: 2, 'VIP table for two': 1 },
    tickets: [
      ...tickets(5002, 'Regular', 2),
      { id: uid(50029), ticket_type: 'VIP table for two', ticket_index: 1, checked_in_at: null },
    ],
  }),
  eventBooking(5003, 1003, { tickets: tickets(5003, 'Regular', 2, 1) }),
  eventBooking(5004, 1002, {
    total_amount: 0,
    ticket_details: { 'Free entry': 1 },
    guests: 1,
    tickets: tickets(5004, 'Free entry', 1),
  }),
  eventBooking(5005, 1005, {
    status: 'pending',
    payment_status: 'pending',
    total_amount: 35000,
    guests: 1,
    ticket_details: { 'Two-day pass': 1 },
    tickets: [],
    created_at: minutesFromNow(-12),
  }),
  eventBooking(5006, 1004, { status: 'cancelled', payment_status: 'failed', tickets: [] }),
  eventBooking(5007, 1003, {
    status: 'cancelled',
    payment_status: 'refunded',
    total_amount: 70000,
  }),
  eventBooking(5008, 1090, {
    status: 'completed',
    total_amount: 16000,
    booking_date: day(-25),
    created_at: minutesFromNow(-60 * 24 * 25),
    tickets: tickets(5008, 'Regular', 2, 2),
  }),
];

function hotelBooking(n: number, h: number, r: number, extra: Row): Row {
  const ho = hotel(h);
  const rt = room(r);
  return {
    id: uid(n),
    customer_id: C,
    hotel_id: ho.id,
    room_type_id: rt.id,
    check_in_date: day(10),
    check_out_date: day(13),
    adults: 2,
    children: 0,
    payment_status: 'completed',
    total_amount: 255000,
    booking_status: 'confirmed',
    checked_in: false,
    checked_in_at: null,
    checked_out_at: null,
    check_in_code: 'K7Q2M9XD',
    created_at: minutesFromNow(-60 * 24 * 5),
    hotel: hotelOf(ho),
    room_type: { id: rt.id, name: rt.name },
    room_number: null,
    guest_name: ACCOUNTS.customer.name,
    guest_email: ACCOUNTS.customer.email,
    guest_phone: '+2348031234567',
    ...extra,
  };
}

// Hotel stays: checking in today (Today banner, check-in code), upcoming, staying now, checked
// out (leave a review), a long hotel name, pending payment, cancelled and refunded.
export const HOTEL_BOOKINGS: Row[] = [
  hotelBooking(6001, 2001, 2101, {
    check_in_date: day(0),
    check_out_date: day(2),
    check_in_code: 'TDY4CODE',
  }),
  hotelBooking(6002, 2001, 2102, {
    check_in_date: day(30),
    check_out_date: day(37),
    total_amount: 3150000,
    adults: 4,
    children: 2,
    check_in_code: 'P3NT4H0S',
  }),
  hotelBooking(6003, 2002, 2201, {
    check_in_date: day(-1),
    check_out_date: day(2),
    booking_status: 'checked_in',
    checked_in: true,
    checked_in_at: minutesFromNow(-60 * 20),
    room_number: '214',
    total_amount: 84000,
  }),
  hotelBooking(6004, 2006, 2601, {
    check_in_date: day(-14),
    check_out_date: day(-11),
    booking_status: 'checked_out',
    checked_in: true,
    checked_in_at: minutesFromNow(-60 * 24 * 14),
    checked_out_at: minutesFromNow(-60 * 24 * 11),
    total_amount: 210000,
  }),
  hotelBooking(6005, 2001, 2102, {
    payment_status: 'pending',
    check_in_code: null,
    created_at: minutesFromNow(-8),
    total_amount: 660000,
  }),
  hotelBooking(6006, 2001, 2101, {
    booking_status: 'cancelled',
    payment_status: 'refunded',
    check_in_code: null,
  }),
];

function apartmentBooking(n: number, a: number, extra: Row): Row {
  return {
    id: uid(n),
    user_id: C,
    apartment_id: apt(a).id,
    check_in_date: day(18),
    check_out_date: day(22),
    number_of_nights: 4,
    number_of_guests: 2,
    payment_status: 'paid',
    total_amount: 260000,
    booking_status: 'confirmed',
    checked_in_at: null,
    checked_out_at: null,
    created_at: minutesFromNow(-60 * 24 * 2),
    apartment: apartmentOf(apt(a)),
    ...extra,
  };
}

// Apartment stays: upcoming, pending payment, a 30-night stay, completed, cancelled, no-show.
export const APARTMENT_BOOKINGS: Row[] = [
  apartmentBooking(7001, 3001, {}),
  apartmentBooking(7002, 3001, {
    payment_status: 'pending',
    booking_status: 'pending',
    total_amount: 2250000,
    created_at: minutesFromNow(-5),
  }),
  apartmentBooking(7003, 3003, {
    check_in_date: day(45),
    check_out_date: day(75),
    number_of_nights: 30,
    total_amount: 600000,
  }),
  apartmentBooking(7004, 3001, {
    check_in_date: day(-40),
    check_out_date: day(-35),
    number_of_nights: 5,
    booking_status: 'completed',
    checked_in_at: minutesFromNow(-60 * 24 * 40),
    checked_out_at: minutesFromNow(-60 * 24 * 35),
  }),
  apartmentBooking(7005, 3003, {
    booking_status: 'cancelled',
    payment_status: 'refunded',
    total_amount: 72000,
  }),
  apartmentBooking(7006, 3003, {
    check_in_date: day(-9),
    check_out_date: day(-2),
    booking_status: 'no_show',
    total_amount: 210000,
  }),
];

const note = (
  n: number,
  type: string,
  title: string,
  message: string,
  read: boolean,
  minutesAgo: number,
  link: string | null = null,
): Row => ({
  id: uid(n),
  user_id: C,
  type,
  title,
  message,
  data: null,
  link,
  read,
  created_at: minutesFromNow(-minutesAgo),
});

// Unread and read, today and older, a very long one, and one with a link.
export const NOTIFICATIONS: Row[] = [
  note(
    8001,
    'booking_confirmed',
    'Your tickets are ready',
    'Lagos Jazz Night: 3 tickets. Show your code at the door.',
    false,
    4,
  ),
  note(
    8002,
    'check_in_reminder',
    'Check-in today',
    'Your stay at The Lagoon House Ikoyi starts at 2 pm. Your check-in code is in the app.',
    false,
    90,
  ),
  note(
    8003,
    'payment_pending',
    'Finish paying for your stay',
    'Your Executive Suite booking is held for 30 minutes. Pay now to keep it.',
    false,
    8,
  ),
  note(
    8004,
    'refund_processed',
    'Refund on its way',
    'We’ve refunded ₦70,000 for Arena concert: the big one. It can take up to 10 working days to show in your account, depending on your bank. If it hasn’t arrived after that, reply to this message or contact support with your booking reference and we’ll chase it with the payment provider for you.',
    true,
    60 * 26,
  ),
  note(
    8005,
    'review_request',
    'How was your stay?',
    'Tell others about Maitama Court Hotel.',
    true,
    60 * 24 * 10,
  ),
  note(
    8006,
    'event_update',
    'Time change',
    'Comedy night now starts at 7:30 pm.',
    true,
    60 * 24 * 3,
    '/listing/event/' + uid(1004),
  ),
  ...Array.from({ length: 10 }, (_, i) =>
    note(
      8100 + i,
      'promo',
      `Weekend picks #${String(i + 1)}`,
      'Hotels, apartments and events near you this weekend.',
      true,
      60 * 24 * (12 + i),
    ),
  ),
];

const textOf = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const firstOf = (v: unknown): string | null => (Array.isArray(v) ? textOf(v[0]) : null);

const saved = (
  n: number,
  l: Row,
  kind: 'hotel' | 'apartment' | 'event',
  minutesAgo: number,
): Row => ({
  id: uid(n),
  user_id: C,
  listing_id: l.id,
  listing_type: kind,
  listing_title: textOf(l.title) ?? textOf(l.name),
  listing_image: firstOf(l.image_urls) ?? firstOf(l.media_urls),
  listing_location: textOf(l.location) ?? textOf(l.area) ?? textOf(l.city),
  created_at: minutesFromNow(-minutesAgo),
});

// Saved: complete listings of each kind, and one whose listing is gone.
export const SAVED: Row[] = [
  saved(9001, hotel(2001), 'hotel', 30),
  saved(9002, apt(3003), 'apartment', 60),
  saved(9003, ev(1001), 'event', 120),
  saved(9004, ev(1005), 'event', 200),
  saved(9005, hotel(2006), 'hotel', 400),
  {
    id: uid(9006),
    user_id: C,
    listing_id: uid(9999),
    listing_type: 'hotel',
    listing_title: 'A hotel that has closed',
    listing_image: photo('gone'),
    listing_location: 'Ajah',
    created_at: minutesFromNow(-900),
  },
];

const NAMES = [
  'Chioma A.',
  'Ibrahim M.',
  'Folake O.',
  'Emeka N.',
  'Zainab K.',
  'Segun B.',
  null,
  'Amaka E.',
];
const COMMENTS = [
  'Lovely stay, the staff were great and the room was spotless.',
  'Good location but the Wi-Fi kept dropping in the evenings.',
  'Exactly as described. Would book again.',
  null,
  'The view from the room was worth every naira. Breakfast was excellent, with plenty of Nigerian options, and the pool was clean and quiet even at the weekend. The only thing I would change is the check-in queue on Friday evening, which took about forty minutes because there was only one person at the desk. Otherwise a perfect weekend away.',
  'Not great. The generator was loud and we were moved rooms twice.',
];

/** `n` reviews for a listing: mixed ratings, anonymous, no comment, very long, host replies. */
export function reviewsFor(listingId: string, n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${listingId}-r${String(i)}`,
    customer_name: NAMES[i % NAMES.length] ?? null,
    rating: [5, 4, 5, 3, 5, 2, 4, 1][i % 8] ?? 5,
    comment: COMMENTS[i % COMMENTS.length] ?? null,
    verified_booking: i % 3 !== 2,
    created_at: minutesFromNow(-60 * 24 * (i * 4 + 2)),
    vendor_response:
      i % 5 === 1 ? 'Thank you for staying with us. We’ve fixed the Wi-Fi in that wing.' : null,
    vendor_response_date: i % 5 === 1 ? minutesFromNow(-60 * 24 * (i * 4)) : null,
  }));
}

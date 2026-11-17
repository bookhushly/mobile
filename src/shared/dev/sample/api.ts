import { signUp } from './auth';
import { reviewsFor } from './data/people';
import { FREE_ROOMS } from './data/stays';
import { run, tables, type Row } from './db';
import { bodyOf, headerOf, json, userOfToken, type Handled } from './respond';
import { day, minutesFromNow, uid } from './time';

const PAGE = 20;
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Reviews per listing: one hotel has many (pagination), the bare ones none. */
const REVIEW_COUNTS: Record<string, number> = {
  [uid(2001)]: 47,
  [uid(2006)]: 128,
  [uid(3001)]: 31,
  [uid(3003)]: 12,
};

function listItems(category: string): Row[] {
  if (category === 'hotels')
    return (tables.hotels ?? []).map((h) => ({
      id: h.id,
      title: h.name,
      location: h.address,
      price: h.min_room_price ?? 0,
      media_urls: h.image_urls,
      city: h.city,
      state: h.state,
      avg_rating: h.avg_rating,
      review_count: h.review_count,
      breakfast_offered: h.breakfast_offered,
      generator_available: h.generator_available,
      created_at: h.id,
    }));
  if (category === 'serviced_apartments')
    return (tables.serviced_apartments ?? [])
      .filter((a) => a.status === 'active')
      .map((a) => ({
        id: a.id,
        title: a.name,
        location: a.address,
        price: a.price_per_night,
        media_urls: a.image_urls,
        city: a.city,
        state: a.state,
        area: a.area,
        apartment_type: a.apartment_type,
        bedrooms: a.bedrooms,
        bathrooms: a.bathrooms,
        max_guests: a.max_guests,
        minimum_stay: a.minimum_stay,
        avg_rating: a.avg_rating,
        review_count: a.review_count,
        furnished: a.furnished,
        created_at: a.id,
      }));
  return (tables.listings ?? [])
    .filter((e) => str(e.event_date).slice(0, 10) >= day(0))
    .map((e) => ({
      id: e.id,
      title: e.title,
      location: e.location,
      price: e.price,
      media_urls: e.media_urls,
      vendor_name: e.vendor_name,
      event_date: e.event_date,
      event_time: e.event_time,
      city: e.city,
      state: e.state,
      category_data: { low_stock_threshold: e.low_stock_threshold },
      created_at: e.id,
    }));
}

// GET /api/listings: category, search, city/state, price and rating filters, sort, 20 per page.
function listings(p: URLSearchParams): Response {
  const category = p.get('category') ?? '';
  if (category === '') return json({ error: 'category is required' }, 400);
  const q = (p.get('search') ?? '').toLowerCase();
  const city = p.get('city');
  const state = p.get('state');
  const min = p.get('price_min');
  const max = p.get('price_max');
  const rating = p.get('min_rating');
  let items = listItems(category).filter(
    (i) =>
      (q === '' || `${str(i.title)} ${str(i.location)} ${str(i.city)}`.toLowerCase().includes(q)) &&
      (city === null || i.city === city) &&
      (state === null || i.state === state) &&
      (min === null || num(i.price) >= Number(min)) &&
      (max === null || num(i.price) <= Number(max)) &&
      (rating === null || num(i.avg_rating) >= Number(rating)),
  );
  const sort = p.get('sort') ?? 'newest';
  const by = (f: (r: Row) => number) => [...items].sort((a, b) => f(a) - f(b));
  if (sort === 'price_asc') items = by((r) => num(r.price));
  else if (sort === 'price_desc') items = by((r) => -num(r.price));
  else if (sort === 'top_rated')
    items =
      category === 'events'
        ? [...items].sort((a, b) => str(a.event_time).localeCompare(str(b.event_time)))
        : by((r) => -num(r.avg_rating));
  else items = [...items].reverse();
  const page = Number(p.get('page') ?? '0');
  const slice = items.slice(page * PAGE, (page + 1) * PAGE);
  const more = (page + 1) * PAGE < items.length;
  return json({ items: slice, ...(more ? { nextPage: page + 1 } : {}), totalCount: items.length });
}

function reviews(listingId: string, p: URLSearchParams): Response {
  const all = reviewsFor(listingId, REVIEW_COUNTS[listingId] ?? 0);
  const page = Number(p.get('page') ?? '1');
  const limit = Number(p.get('limit') ?? '10');
  const slice = all.slice((page - 1) * limit, page * limit);
  return json({
    data: {
      reviews: slice,
      stats: {},
      pagination: { hasMore: page * limit < all.length, total: all.length },
    },
  });
}

// Payments: reference → the booking it pays for. Paid as soon as the status is checked.
const payments = new Map<string, { kind: string; id: string; amount: number }>();

function bookingTable(kind: string): { table: Row[]; paidStatus: string } {
  if (kind === 'event') return { table: tables.event_bookings ?? [], paidStatus: 'completed' };
  if (kind === 'hotel') return { table: tables.hotel_bookings ?? [], paidStatus: 'completed' };
  return { table: tables.apartment_bookings ?? [], paidStatus: 'paid' };
}

function markPaid(kind: string, id: string) {
  const { table, paidStatus } = bookingTable(kind);
  const row = table.find((r) => r.id === id);
  if (row === undefined) return;
  row.payment_status = paidStatus;
  if (kind === 'event') row.status = 'confirmed';
  if (kind === 'apartment') row.booking_status = 'confirmed';
  if (kind === 'hotel') row.check_in_code = 'N3WC0D3X';
}

function nightsBetween(a: string, b: string): number {
  return Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));
}

function createStay(
  kind: 'hotel' | 'apartment',
  body: Record<string, unknown>,
  userId: string,
): Response {
  const checkIn = str(body.check_in_date);
  const checkOut = str(body.check_out_date);
  const nights = nightsBetween(checkIn, checkOut);
  const n =
    7500 +
    payments.size +
    (tables.hotel_bookings?.length ?? 0) +
    (tables.apartment_bookings?.length ?? 0);
  const id = uid(n);
  const created = new Date().toISOString();
  if (kind === 'hotel') {
    const rt = tables.hotel_room_types?.find((r) => r.id === body.room_type_id);
    const h = tables.hotels?.find((x) => x.id === body.hotel_id);
    if (rt === undefined || h === undefined) return json({ error: 'not_found' }, 404);
    if ((FREE_ROOMS[str(rt.id)] ?? 0) === 0)
      return json({ error: 'No rooms left', code: 'unavailable' }, 409);
    const total = num(rt.base_price) * nights;
    tables.hotel_bookings?.unshift({
      id,
      customer_id: userId,
      hotel_id: h.id,
      room_type_id: rt.id,
      check_in_date: checkIn,
      check_out_date: checkOut,
      adults: body.adults,
      children: body.children,
      payment_status: 'pending',
      total_amount: total,
      booking_status: 'confirmed',
      checked_in: false,
      checked_in_at: null,
      checked_out_at: null,
      check_in_code: null,
      created_at: created,
      hotel: {
        id: h.id,
        name: h.name,
        city: h.city,
        state: h.state,
        address: h.address,
        image_urls: h.image_urls,
        check_in_time: h.check_in_time,
        check_out_time: h.check_out_time,
      },
      room_type: { id: rt.id, name: rt.name },
    });
    return json(
      {
        booking: {
          id,
          type: 'hotel',
          status: 'confirmed',
          payment_status: 'pending',
          total,
          currency: 'NGN',
          nights,
          check_in_date: checkIn,
          check_out_date: checkOut,
          guest_name: str(body.guest_name),
          guest_email: str(body.guest_email),
          guest_phone: str(body.guest_phone),
          pricing: { base: total, service_charge: 0 },
          created_at: created,
          hotel: { id: h.id, name: h.name },
          room_type: { id: rt.id, name: rt.name },
        },
        next: {
          payment: { type: 'hotel', id, amount: total, endpoint: '/api/payment/initialize' },
        },
      },
      201,
    );
  }
  const a = tables.serviced_apartments?.find((x) => x.id === body.apartment_id);
  if (a === undefined) return json({ error: 'not_found' }, 404);
  const total = num(a.price_per_night) * nights;
  tables.apartment_bookings?.unshift({
    id,
    user_id: userId,
    apartment_id: a.id,
    check_in_date: checkIn,
    check_out_date: checkOut,
    number_of_nights: nights,
    number_of_guests: body.number_of_guests,
    payment_status: 'pending',
    total_amount: total,
    booking_status: 'pending',
    checked_in_at: null,
    checked_out_at: null,
    created_at: created,
    apartment: {
      id: a.id,
      name: a.name,
      city: a.city,
      state: a.state,
      area: a.area,
      address: a.address,
      image_urls: a.image_urls,
      check_in_time: a.check_in_time,
      check_out_time: a.check_out_time,
    },
  });
  return json(
    {
      booking: {
        id,
        type: 'apartment',
        status: 'pending',
        payment_status: 'pending',
        total,
        currency: 'NGN',
        nights,
        check_in_date: checkIn,
        check_out_date: checkOut,
        guest_name: str(body.guest_name),
        guest_email: str(body.guest_email),
        guest_phone: str(body.guest_phone),
        pricing: { base: total },
        created_at: created,
        apartment: { id: a.id, name: a.name },
      },
      next: {
        payment: { type: 'apartment', id, amount: total, endpoint: '/api/payment/initialize' },
      },
    },
    201,
  );
}

function createEvent(body: Record<string, unknown>, userId: string, free: boolean): Response {
  const e = tables.listings?.find((x) => x.id === body.listing_id);
  if (e === undefined) return json({ error: 'not_found' }, 404);
  if (num(e.remaining_tickets) === 0) return json({ error: 'Sold out', code: 'sold_out' }, 409);
  const lines =
    typeof body.ticket_details === 'object' && body.ticket_details !== null
      ? (body.ticket_details as Record<string, unknown>)
      : {};
  const packages = list(e.ticket_packages) as Row[];
  let total = 0;
  const tickets: Row[] = [];
  const id = uid(5500 + (tables.event_bookings?.length ?? 0));
  for (const [name, q] of Object.entries(lines)) {
    const price = num(packages.find((p) => p.name === name)?.price ?? e.price);
    total += price * num(q);
    for (let i = 0; i < num(q); i++)
      tickets.push({
        id: `${id}-${name}-${String(i)}`,
        ticket_type: name,
        ticket_index: i + 1,
        checked_in_at: null,
      });
  }
  const created = new Date().toISOString();
  const confirmed = free || total === 0;
  tables.event_bookings?.unshift({
    id,
    customer_id: userId,
    listing_id: e.id,
    status: confirmed ? 'confirmed' : 'pending',
    payment_status: confirmed ? 'completed' : 'pending',
    total_amount: total,
    booking_date: day(0),
    booking_time: null,
    guests: tickets.length,
    ticket_details: lines,
    seat_assignments: null,
    created_at: created,
    listing: {
      id: e.id,
      title: e.title,
      location: e.location,
      media_urls: e.media_urls,
      event_date: e.event_date,
      event_end_date: e.event_end_date,
      event_time: e.event_time,
      require_dynamic_ticket: e.require_dynamic_ticket,
    },
    tickets: confirmed ? tickets : [],
  });
  return json(
    {
      booking: {
        id,
        status: confirmed ? 'confirmed' : 'pending',
        payment_status: confirmed ? 'completed' : 'pending',
        total_amount: total,
        created_at: created,
        listing_id: str(e.id),
        ticket_details: lines,
      },
    },
    201,
  );
}

function codes(bookingId: string): Response {
  const b = tables.event_bookings?.find((r) => r.id === bookingId);
  if (b === undefined) return json({ error: 'not_found', code: 'not_found' }, 404);
  const step = 30;
  const expires = (Math.floor(Date.now() / 1000 / step) + 1) * step * 1000;
  const tickets = (list(b.tickets) as Row[]).map((t) => ({
    id: t.id,
    ticket_type: t.ticket_type,
    ticket_index: t.ticket_index,
    checked_in_at: t.checked_in_at,
    token:
      t.checked_in_at === null
        ? `BH2.sample.${str(t.id)}.${String(Math.floor(Date.now() / 30000))}.sig`
        : null,
  }));
  return json({
    format: tickets.length === 0 ? null : 2,
    expires_at: tickets.length === 0 ? null : expires,
    step_seconds: step,
    tickets,
  });
}

/** The Bookhushly web API (`/api/*`). */
export async function handleApi(
  path: string,
  p: URLSearchParams,
  init?: RequestInit,
): Promise<Handled> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const me = userOfToken(headerOf(init, 'Authorization'));
  const body = method === 'GET' ? {} : await bodyOf(init);
  const parts = path.split('/').filter(Boolean); // ['api', ...]
  const needMe = () => (me === null ? json({ error: 'unauthorized' }, 401) : null);

  if (path === '/api/listings') return listings(p);
  if (parts[1] === 'reviews' && parts[2] !== undefined) {
    if (method === 'POST') return json({ data: { id: uid(Date.now() % 1e9) } }, 201);
    return reviews(decodeURIComponent(parts[2]), p);
  }
  if (path === '/api/service-charges') {
    const type = p.get('type');
    if (type === 'apartment') return json({ charge: null });
    return json({
      charge: {
        service_type: type,
        charge_type: 'percentage',
        charge_value: 5,
        enabled: true,
        label: 'Service fee',
      },
    });
  }
  if (parts[1] === 'hotels' && parts[2] === 'room-types' && parts[4] === 'availability') {
    const free = FREE_ROOMS[decodeURIComponent(parts[3] ?? '')] ?? 0;
    return json({ totalRooms: 10, bookedCount: 10 - free, freeRooms: free, available: free > 0 });
  }
  if (path === '/api/promo/validate') {
    const amount = num(body.amount);
    if (str(body.code).toUpperCase() !== 'SAVE10')
      return json({ valid: false, error: 'This code isn’t valid.' });
    return json({
      valid: true,
      code_id: uid(4001),
      code: 'SAVE10',
      discount_type: 'percentage',
      discount_value: 10,
      discount_amount: Math.round(amount * 0.1),
      discounted_total: Math.round(amount * 0.9),
    });
  }
  if (path === '/api/auth/signup') return signUp(body);
  if (
    path === '/api/auth/resend-confirmation' ||
    path === '/api/auth/forgot-password' ||
    path === '/api/auth/reset-password'
  )
    return json({ ok: true }, path === '/api/auth/reset-password' ? 200 : 202);

  const denied = needMe();
  if (denied !== null) return denied;
  const userId = me ?? '';

  if (path === '/api/bookings/hotel' && method === 'POST') return createStay('hotel', body, userId);
  if (path === '/api/bookings/apartment' && method === 'POST')
    return createStay('apartment', body, userId);
  if (path === '/api/bookings/event/create') return createEvent(body, userId, false);
  if (path === '/api/bookings/event/free') return createEvent(body, userId, true);
  if (path === '/api/payment/initialize') {
    const reference = `sample_${str(body.requestId).slice(-6)}_${String(Date.now() % 100000)}`;
    const { table } = bookingTable(str(body.requestType));
    const amount = num(table.find((r) => r.id === body.requestId)?.total_amount);
    payments.set(reference, { kind: str(body.requestType), id: str(body.requestId), amount });
    return json({
      success: true,
      payment: {
        id: reference,
        reference,
        amount: Math.round(amount * 1.05),
        base_amount: amount,
        service_charge_amount: Math.round(amount * 0.05),
        service_charge_label: 'Service fee',
        currency: 'NGN',
        payment_url: 'https://example.com/?sample-checkout',
      },
    });
  }
  if (path === '/api/payment/check-status') {
    const ref = [...payments.entries()].find(([, v]) => v.id === body.requestId)?.[0];
    if (ref === undefined) return json({ hasPaid: false, hasPending: false });
    return json({
      hasPaid: false,
      hasPending: true,
      payment: { reference: ref, status: 'pending', created_at: minutesFromNow(-1) },
    });
  }
  if (path === '/api/payment/verify') {
    const pay = payments.get(str(body.reference));
    if (pay !== undefined) markPaid(pay.kind, pay.id);
    return json({
      verified: pay !== undefined,
      status: pay !== undefined ? 'completed' : 'failed',
    });
  }
  if (parts[1] === 'payment' && parts[2] === 'status' && parts[3] !== undefined) {
    const ref = decodeURIComponent(parts[3]);
    const pay = payments.get(ref);
    if (pay === undefined) return json({ error: 'not_found' }, 404);
    markPaid(pay.kind, pay.id);
    return json({
      payment: { reference: ref, status: 'completed', fulfilled: true, request_type: pay.kind },
      request: { id: pay.id, status: 'confirmed', payment_status: 'completed' },
    });
  }
  if (parts[1] === 'bookings' && parts[4] === 'cancel') {
    const { table } = bookingTable(parts[2] ?? '');
    const row = table.find((r) => r.id === decodeURIComponent(parts[3] ?? ''));
    if (row === undefined) return json({ error: 'not_found' }, 404);
    if ('status' in row) row.status = 'cancelled';
    if ('booking_status' in row) row.booking_status = 'cancelled';
    row.payment_status = 'refunded';
    return json({ success: true, refunded: true });
  }
  if (path === '/api/refunds/request') return json({ refund_request: { id: uid(4100) } }, 201);
  if (parts[1] === 'bookings' && parts[2] === 'event' && parts[4] === 'transfer')
    return json({ transferred_to: str(body.new_email) });
  if (parts[1] === 'bookings' && parts[2] === 'event' && parts[4] === 'codes')
    return codes(decodeURIComponent(parts[3] ?? ''));
  if (parts[1] === 'tickets' && parts[3] === 'code') {
    const id = decodeURIComponent(parts[2] ?? '');
    return json({
      token: `BH2.sample.${id}.${String(Math.floor(Date.now() / 30000))}.sig`,
      format: 2,
      expires_at: (Math.floor(Date.now() / 30000) + 1) * 30000,
      step_seconds: 30,
      ticket: { ticket_type: 'Regular', ticket_index: 1 },
    });
  }
  if (path === '/api/notifications/read-all') {
    const mine = (tables.notifications ?? []).filter(
      (n) => n.user_id === userId && n.read === false,
    );
    for (const n of mine) n.read = true;
    return json({ updated: mine.length });
  }
  if (path === '/api/bookings/claim' && method === 'GET')
    return json({ events: 1, hotels: 1, apartments: 0, total: 2 });
  if (path === '/api/bookings/claim/code') return json({ sent: true });
  if (path === '/api/bookings/claim') {
    if (body.code !== '123456') return json({ error: 'invalid_code', code: 'invalid_code' }, 400);
    return json({
      claimed: { events: 1, hotels: 1, apartments: 0, total: 2 },
      booking_ids: null,
      payments: 0,
    });
  }
  if (path === '/api/bookings/mine') {
    const q = { filters: [], order: [['created_at', true]] as [string, boolean][], limit: 50 };
    const mine = (t: string, owner: string) =>
      run(
        (tables[t] ?? []).filter((r) => r[owner] === userId),
        q,
      );
    return json({
      events: mine('event_bookings', 'customer_id'),
      hotels: mine('hotel_bookings', 'customer_id'),
      apartments: mine('apartment_bookings', 'user_id'),
    });
  }
  if (path === '/api/account/delete') return json({ ok: true }, 202);
  return null;
}

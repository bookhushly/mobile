import type { Activity, Earnings } from '@/features/vendor/domain/earnings';
import type { VendorJob } from '@/features/vendor/domain/jobs';
import type { ListingBooking, StayStatus } from '@/features/vendor/domain/listings';
import type {
  FactIcon,
  MyOffer,
  OfferStatus,
  RequestDetail,
  VendorRequest,
} from '@/features/vendor/domain/requests';
import type { PhotoKey, RequestType } from '@/features/vendor/domain/today';
import type {
  ApiJob,
  ApiOffer,
  ApiOfferWithRequest,
  ApiRequest,
  ApiStay,
  ApiTransaction,
} from '@/features/vendor/schemas/vendorApi';
import { lagosToday, shortDate, stayRange, type IsoDate } from '@/shared/lib/lagosDay';

// The web's vendor responses (web `docs/mobile/VENDOR_API.md`) as the vendor screens' own types,
// so the screens are the same on sample data and live data.

const LOGISTICS_SERVICE: Record<string, string> = {
  delivery: 'Delivery',
  courier: 'Courier delivery',
  moving: 'Moving',
  cargo: 'Cargo',
};
const VEHICLE: Record<string, string> = {
  sedan: 'Sedan',
  suv: 'SUV',
  minivan: 'Minivan',
  luxury: 'Luxury car',
  bus: 'Bus',
  coaster: 'Coaster bus',
  pickup: 'Pickup truck',
  bike: 'Motorbike',
  car: 'Car',
  van: 'Van',
  truck: 'Truck',
  trailer: 'Trailer',
};
const TRIP: Record<string, string> = { chauffeur: 'with driver', self_drive: 'self-drive' };
const SECURITY_SERVICE: Record<string, string> = {
  residential: 'home',
  corporate: 'business',
  event_security: 'event',
  personal_security: 'personal',
  escort: 'escort',
};
const GUARD: Record<string, string> = {
  unarmed: 'Unarmed',
  armed: 'Armed',
  both: 'Armed and unarmed',
};

const word = (map: Record<string, string>, v: string | null | undefined, fallback: string) =>
  (v !== null && v !== undefined ? map[v] : undefined) ?? fallback;

const isDate = (d: string | null | undefined): d is IsoDate =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

function photoFor(
  type: RequestType,
  r: Pick<ApiRequest, 'vehicle_type' | 'service_type' | 'trip_type'>,
): PhotoKey {
  if (type === 'security') return 'security';
  if (type === 'car_rental') {
    const v = r.vehicle_type;
    if (v === 'suv' || v === 'pickup') return 'suv';
    if (v === 'bus' || v === 'coaster' || v === 'minivan') return 'bus';
    if (v === 'sedan' || v === 'luxury') return 'sedan';
    return r.trip_type === 'chauffeur' ? 'withDriver' : 'sedan';
  }
  switch (r.vehicle_type) {
    case 'truck':
    case 'trailer':
      return 'truck';
    case 'van':
      return 'van';
    case 'bike':
      return 'motorcycle';
    case 'car':
      return 'sedan';
    case null:
    case undefined:
    default:
      break;
  }
  switch (r.service_type) {
    case 'moving':
      return 'moving';
    case 'courier':
      return 'courier';
    case 'cargo':
      return 'truck';
    case null:
    case undefined:
    default:
      return 'delivery';
  }
}

function titleFor(type: RequestType, r: ApiRequest): string {
  if (type === 'logistics') {
    const item = r.item_description?.trim() ?? '';
    return item !== '' ? item : word(LOGISTICS_SERVICE, r.service_type, 'Delivery');
  }
  if (type === 'car_rental') {
    const car = word(VEHICLE, r.vehicle_type, 'Car');
    return r.trip_type ? `${car}, ${word(TRIP, r.trip_type, '')}`.replace(/, $/, '') : car;
  }
  const n = r.number_of_guards ?? 1;
  return `${String(n)} ${n === 1 ? 'guard' : 'guards'}, ${word(SECURITY_SERVICE, r.service_type, 'security')}`;
}

function summaryFor(type: RequestType, r: ApiRequest): string {
  if (type === 'security') {
    const where = r.state ?? '';
    return isDate(r.start_date) ? `${where} · from ${shortDate(r.start_date)}` : where;
  }
  const from = r.pickup_state ?? '';
  const toState = type === 'logistics' ? r.delivery_state : r.destination_state;
  const where = toState && toState !== from ? `${from} → ${toState}` : from;
  const start = r.pickup_date;
  if (!isDate(start)) return where;
  if (type === 'car_rental' && isDate(r.return_date) && r.return_date !== start)
    return `${where} · ${stayRange(start, r.return_date)}`;
  return `${where} · ${shortDate(start)}`;
}

export const requestTypeOf = (t: string): RequestType | null =>
  t === 'car_rental' || t === 'logistics' || t === 'security' ? t : null;

export function myOfferFrom(o: ApiOffer): MyOffer {
  return { id: o.id, amount: o.amount, status: o.status, sentAt: o.created_at };
}

export function requestFrom(
  r: ApiRequest,
  type: RequestType,
  myOffer: MyOffer | null = null,
): VendorRequest {
  return {
    id: r.id,
    requestType: type,
    title: titleFor(type, r),
    summary: summaryFor(type, r),
    closesAt: r.expires_at ?? '',
    quotes: r.offer_count ?? 0,
    photo: photoFor(type, r),
    myOffer,
  };
}

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

export function requestDetailFrom(
  r: ApiRequest,
  type: RequestType,
  myOffer: MyOffer | null,
): RequestDetail {
  const facts: { icon: FactIcon; title: string; detail: string | null }[] = [];
  let from: string;
  let to: string | null;
  let start: RequestDetail['start'];
  let end: RequestDetail['end'] = null;
  if (type === 'logistics') {
    from = r.pickup_address ?? r.pickup_state ?? '';
    to = r.delivery_address ?? r.delivery_state ?? null;
    start = { label: 'Pick-up', date: r.pickup_date ?? '', time: r.pickup_time ?? null };
    if (isDate(r.delivery_date))
      end = {
        label: 'Arrive by',
        value: shortDate(r.delivery_date),
        detail: r.delivery_time ?? null,
      };
    const extras = [
      r.fragile_items ? 'Fragile items' : null,
      r.perishable_items ? 'Perishable' : null,
      r.requires_packaging ? 'Needs packing' : null,
    ].filter((x): x is string => x !== null);
    facts.push({
      icon: 'package',
      title: word(LOGISTICS_SERVICE, r.service_type, 'Delivery'),
      detail: extras.length > 0 ? extras.join(', ') : (r.item_weight ?? null),
    });
    if (r.vehicle_type)
      facts.push({
        icon: 'truck',
        title: word(VEHICLE, r.vehicle_type, r.vehicle_type),
        detail: null,
      });
  } else if (type === 'car_rental') {
    from = r.pickup_address ?? r.pickup_state ?? '';
    to = r.destination_address ?? r.destination_state ?? null;
    start = { label: 'Pick-up', date: r.pickup_date ?? '', time: r.pickup_time ?? null };
    if (isDate(r.return_date))
      end = { label: 'Return', value: shortDate(r.return_date), detail: null };
    facts.push({ icon: 'car', title: titleFor(type, r), detail: r.is_urgent ? 'Urgent' : null });
    if (r.number_of_passengers)
      facts.push({
        icon: 'users',
        title: plural(r.number_of_passengers, 'person', 'people'),
        detail: r.purpose ?? null,
      });
  } else {
    from = r.state ?? '';
    to = null;
    start = { label: 'Start', date: r.start_date ?? '', time: null };
    if (r.duration_type)
      end = { label: 'How long', value: r.duration_type.replace(/_/g, ' '), detail: null };
    const n = r.number_of_guards ?? 1;
    facts.push({
      icon: 'shield',
      title:
        `${plural(n, 'guard', 'guards')}, ${word(GUARD, r.guard_type, '').toLowerCase()}`.replace(
          /, $/,
          '',
        ),
      detail: r.risk_level ? `Risk: ${r.risk_level}` : null,
    });
    const extras = [
      r.requires_canine ? 'a guard dog' : null,
      r.requires_vehicle ? 'a patrol vehicle' : null,
      r.vip_protection ? 'VIP protection' : null,
    ].filter((x): x is string => x !== null);
    if (extras.length > 0)
      facts.push({ icon: 'note', title: `Also: ${extras.join(', ')}`, detail: null });
  }
  const note = (r.special_instructions ?? r.additional_notes ?? '').trim();
  return {
    ...requestFrom(r, type, myOffer),
    from,
    to,
    start,
    end,
    facts,
    note: note === '' ? null : note,
  };
}

/** Quoted and Won come from my offers: the request snapshot plus my offer on it. */
export function offerRequestFrom(o: ApiOfferWithRequest): VendorRequest | null {
  const type = requestTypeOf(o.request_type);
  if (type === null || o.request === null) return null;
  const s = o.request;
  const what = s.what ?? null;
  const title =
    type === 'logistics'
      ? word(LOGISTICS_SERVICE, what, 'Delivery')
      : type === 'car_rental'
        ? word(VEHICLE, what, word(TRIP, what, 'Car'))
        : `Security, ${word(SECURITY_SERVICE, what, 'guards')}`;
  return {
    id: s.id,
    requestType: type,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    summary: isDate(s.when) ? `${s.where ?? ''} · ${shortDate(s.when)}` : (s.where ?? ''),
    closesAt: '',
    quotes: 0,
    photo: photoFor(type, { vehicle_type: what, service_type: what, trip_type: what }),
    myOffer: myOfferFrom(o),
  };
}

const OFFER_ORDER: Record<OfferStatus, number> = {
  pending: 0,
  accepted: 1,
  rejected: 2,
  expired: 3,
  withdrawn: 4,
};
export const byOfferStatus = (a: VendorRequest, b: VendorRequest) =>
  OFFER_ORDER[a.myOffer?.status ?? 'withdrawn'] - OFFER_ORDER[b.myOffer?.status ?? 'withdrawn'];

/** A Lagos date and `HH:MM` as an instant (Lagos is UTC+1 all year). */
function lagosInstant(date: string | null | undefined, time: string | null | undefined): string {
  if (!isDate(date)) return '';
  const t = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '00:00';
  return new Date(Date.parse(`${date}T${t}:00+01:00`)).toISOString();
}

export function jobFrom(j: ApiJob): VendorJob | null {
  const s = j.status;
  if (
    s !== 'matched' &&
    s !== 'paid' &&
    s !== 'in_progress' &&
    s !== 'completed' &&
    s !== 'disputed'
  )
    return null;
  const type = j.request_type;
  const security = type === 'security';
  const from = security ? (j.state ?? '') : (j.pickup_address ?? j.pickup_state ?? '');
  const to = security
    ? null
    : type === 'logistics'
      ? (j.delivery_address ?? j.delivery_state ?? null)
      : (j.destination_address ?? j.destination_state ?? null);
  const toShort = security
    ? null
    : type === 'logistics'
      ? (j.delivery_state ?? null)
      : (j.destination_state ?? null);
  return {
    id: j.id,
    requestType: type,
    title: titleFor(type, j),
    startsAt: security
      ? lagosInstant(j.start_date, null)
      : lagosInstant(j.pickup_date, j.pickup_time),
    from,
    to,
    toShort,
    customer: { name: j.customer_first_name ?? 'The customer', phone: j.customer_phone ?? null },
    paid: j.selected_offer?.amount ?? 0,
    payout: j.payout_amount ?? 0,
    status: s,
    vendorCompletedAt: j.vendor_completed_at ?? null,
    milestones: {
      pickedUpAt: j.picked_up_at ?? null,
      inTransitAt: j.in_transit_at ?? null,
      deliveredAt: j.delivered_at ?? null,
    },
    photo: photoFor(type, j),
  };
}

/** Bookhushly's fee, read off past jobs (the server works out the payout but doesn't send the rate). */
export function feeRateFrom(jobs: readonly ApiJob[]): number | null {
  for (const j of jobs) {
    const price = j.selected_offer?.amount;
    if (price && j.payout_amount !== null && j.payout_amount !== undefined && price > 0)
      return Math.round((1 - j.payout_amount / price) * 100) / 100;
  }
  return null;
}

/** Completed payouts, day by day: this month so far and the same days of last month. */
export function monthFrom(txs: readonly ApiTransaction[], nowMs: number): Earnings['month'] {
  const [y = 0, m = 1, d = 1] = lagosToday(nowMs).split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevDays = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  const nowDaily = Array.from({ length: d }, () => 0);
  const thenDaily = Array.from({ length: Math.min(d, prevDays) }, () => 0);
  for (const t of txs) {
    if (t.transaction_type !== 'payout' || t.status !== 'completed') continue;
    const [ty = 0, tm = 0, td = 0] = lagosToday(Date.parse(t.created_at)).split('-').map(Number);
    if (ty === y && tm === m && td <= d) nowDaily[td - 1] = (nowDaily[td - 1] ?? 0) + t.amount;
    else if (ty === prevY && tm === prevM && td <= thenDaily.length)
      thenDaily[td - 1] = (thenDaily[td - 1] ?? 0) + t.amount;
  }
  const cumulative = (xs: number[]) => {
    let sum = 0;
    return xs.map((x) => (sum += x));
  };
  return { now: cumulative(nowDaily), then: cumulative(thenDaily), daysInMonth };
}

const WITHDRAWAL_STATUS: Record<string, Activity['status']> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  rejected: 'failed',
};

export function earningsFrom(i: {
  balance: number;
  jobs: readonly ApiJob[];
  transactions: readonly ApiTransaction[];
  bank: {
    bank_name?: string | null;
    bank_account_name?: string | null;
    account_number_last2?: string | null;
  } | null;
  nowMs: number;
}): Earnings {
  let held = 0;
  let heldJobs = 0;
  for (const j of i.jobs) {
    if (j.status === 'paid' || j.status === 'in_progress' || j.status === 'disputed') {
      held += j.payout_amount ?? 0;
      heldJobs++;
    }
  }
  const activity: Activity[] = [];
  for (const t of i.transactions) {
    if (t.transaction_type === 'payout') {
      activity.push({
        id: t.id,
        kind: 'payout',
        title: t.description?.trim() || 'Job payment',
        at: t.created_at,
        amount: t.amount,
        status: t.status === 'completed' ? 'completed' : 'pending',
      });
    } else if (t.transaction_type === 'withdrawal') {
      const bank = t.metadata?.bank_name ?? 'your bank';
      const last2 = t.metadata?.account_number_last2;
      activity.push({
        id: t.id,
        kind: 'withdrawal',
        title: `To ${bank}${last2 ? ` ••${last2}` : ''}`,
        at: t.created_at,
        amount: t.amount,
        status: WITHDRAWAL_STATUS[t.withdrawal_status ?? ''] ?? 'pending',
      });
    }
  }
  const bankName = i.bank?.bank_name ?? null;
  const last2 = i.bank?.account_number_last2 ?? null;
  return {
    rail: 'wallet',
    month: monthFrom(i.transactions, i.nowMs),
    wallet: { available: i.balance, held, heldJobs },
    bank: bankName !== null && last2 !== null ? { name: bankName, last2 } : null,
    activity,
  };
}

const STAY_STATUS: Record<string, StayStatus> = {
  pending: 'pending',
  confirmed: 'confirmed',
  checked_in: 'checked_in',
  checked_out: 'checked_out',
  completed: 'checked_out',
  cancelled: 'cancelled',
};

/** A hotel or apartment booking from `/api/vendor/bookings`; null for events or unreadable rows. */
export function stayFrom(b: ApiStay): ListingBooking | null {
  if (b.booking_type === 'event') return null;
  const status = STAY_STATUS[b.status ?? ''];
  if (status === undefined || !isDate(b.booking_date) || !isDate(b.check_out_date)) return null;
  const pay = b.payment_status ?? '';
  return {
    id: b.id,
    kind: b.booking_type,
    guest: b.guest_name?.trim() || 'Guest',
    // Hotel bookings don't carry the room type on this route: the hotel's name stands in.
    unit: b.listings?.title ?? (b.booking_type === 'hotel' ? 'Hotel' : 'Apartment'),
    checkIn: b.booking_date,
    checkOut: b.check_out_date,
    guests: b.guests ?? 1,
    total: b.total_amount ?? 0,
    status,
    // The route makes apartment payment up from the status ("completed" only while confirmed), so
    // an apartment is paid once confirmed, checked in or out (BACKEND_STATUS §9).
    payment:
      b.booking_type === 'apartment'
        ? status === 'confirmed' || status === 'checked_in' || status === 'checked_out'
          ? 'paid'
          : 'unpaid'
        : pay === 'completed' || pay === 'paid'
          ? 'paid'
          : pay === 'pay_at_hotel'
            ? 'payAtHotel'
            : 'unpaid',
  };
}

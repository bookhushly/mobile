import { daysBetween, isIsoDate, type IsoDate } from '@/shared/lib/lagosDay';

// A car rental request as the customer builds it, step by step (Phase 6, design 1A). Values are
// the web's own (`app/(user)/rent-car/page.jsx`, `lib/rfq/schemas.js`): the server re-checks all
// of them, so these checks only keep Next honest.

export const VEHICLE_TYPES = [
  'sedan',
  'suv',
  'minivan',
  'luxury',
  'bus',
  'coaster',
  'pickup',
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const PRICING_MODELS = [
  'full_day',
  'half_day',
  'hourly',
  'per_km',
  'multi_day',
  'fixed',
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const PURPOSES = ['leisure', 'corporate', 'airport', 'wedding', 'other'] as const;
export type Purpose = (typeof PURPOSES)[number];

export type TripType = 'chauffeur' | 'self_drive';

export const STEPS = ['where', 'when', 'how', 'car', 'details', 'check'] as const;
export type Step = (typeof STEPS)[number];

export const MAX_PASSENGERS = 60;
export const NOTES_MAX = 1000;

export type CarDraft = {
  pickupAddress: string;
  pickupState: string | null;
  /** Where the trip ends, when it leaves the pick-up state; null = it doesn't. */
  destination: { state: string | null; address: string } | null;
  pickupDate: IsoDate | null;
  returnDate: IsoDate | null;
  /** `HH:MM`, 24-hour; null = any time. */
  pickupTime: string | null;
  tripType: TripType | null;
  passengers: number;
  /** null = any car. */
  vehicleType: VehicleType | null;
  pricingModel: PricingModel | null;
  /** Hours (hourly) or km (per km), as typed. */
  durationValue: string;
  purpose: Purpose | null;
  notes: string;
  urgent: boolean;
};

export const EMPTY_DRAFT: CarDraft = {
  pickupAddress: '',
  pickupState: null,
  destination: null,
  pickupDate: null,
  returnDate: null,
  pickupTime: null,
  tripType: null,
  passengers: 1,
  vehicleType: null,
  pricingModel: null,
  durationValue: '',
  purpose: null,
  notes: '',
  urgent: false,
};

/** The pricing models whose quote depends on a number the customer estimates. */
export function usesDuration(m: PricingModel | null): m is 'hourly' | 'per_km' {
  return m === 'hourly' || m === 'per_km';
}

/** The typed estimate as a number: null when blank or unused; NaN when it isn't a positive number. */
function duration(d: CarDraft): number | null {
  if (!usesDuration(d.pricingModel)) return null;
  const raw = d.durationValue.trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

const MIN_ADDRESS = 3;

export function stepReady(step: Step, d: CarDraft, today: IsoDate): boolean {
  switch (step) {
    case 'where':
      return (
        d.pickupState !== null &&
        d.pickupAddress.trim().length >= MIN_ADDRESS &&
        (d.destination === null || d.destination.state !== null)
      );
    case 'when':
      return (
        d.pickupDate !== null &&
        isIsoDate(d.pickupDate) &&
        d.pickupDate >= today &&
        (d.returnDate === null || d.returnDate >= d.pickupDate)
      );
    case 'how':
      return d.tripType !== null && d.passengers >= 1 && d.passengers <= MAX_PASSENGERS;
    case 'car':
      return true;
    case 'details':
      return !Number.isNaN(duration(d) ?? 0) && d.notes.trim().length <= NOTES_MAX;
    case 'check':
      return STEPS.every((s) => s === 'check' || stepReady(s, d, today));
  }
}

type Dates = { pickupDate: IsoDate | null; returnDate: IsoDate | null };

/** A tap on the calendar: pick-up first, then the return (the same day is a one-day trip). */
export function pickDay(cur: Dates, day: IsoDate): Dates {
  if (cur.pickupDate === null || cur.returnDate !== null || day < cur.pickupDate) {
    return { pickupDate: day, returnDate: null };
  }
  return { pickupDate: cur.pickupDate, returnDate: day };
}

/** Calendar days the car is out, both ends counted; 0 before a pick-up is chosen. */
export function tripDays(d: Dates): number {
  if (d.pickupDate === null) return 0;
  if (d.returnDate === null) return 1;
  return daysBetween(d.pickupDate, d.returnDate) + 1;
}

export type Contact = { fullName: string; email: string; phone: string };

export type SubmitBody = {
  trip_type: TripType;
  pickup_state: string;
  pickup_address: string;
  pickup_date: IsoDate;
  number_of_passengers: number;
  is_urgent: boolean;
  full_name: string;
  email: string;
  phone: string;
  pickup_time?: string;
  return_date?: IsoDate;
  destination_state?: string;
  destination_address?: string;
  vehicle_type?: VehicleType;
  pricing_model?: PricingModel;
  duration_value?: number;
  purpose?: Purpose;
  additional_notes?: string;
};

/** The body for `POST /api/car-rental/requests`, or null while something required is missing. */
export function submitBody(d: CarDraft, c: Contact, today: IsoDate): SubmitBody | null {
  if (!stepReady('check', d, today)) return null;
  const name = c.fullName.trim();
  const email = c.email.trim();
  const phone = c.phone.trim();
  if (name === '' || email === '' || phone === '') return null;
  // stepReady('check') has proven these.
  if (d.tripType === null || d.pickupState === null || d.pickupDate === null) return null;
  const body: SubmitBody = {
    trip_type: d.tripType,
    pickup_state: d.pickupState,
    pickup_address: d.pickupAddress.trim(),
    pickup_date: d.pickupDate,
    number_of_passengers: d.passengers,
    is_urgent: d.urgent,
    full_name: name,
    email,
    phone,
  };
  if (d.pickupTime !== null) body.pickup_time = d.pickupTime;
  if (d.returnDate !== null) body.return_date = d.returnDate;
  if (d.destination?.state != null) {
    body.destination_state = d.destination.state;
    const addr = d.destination.address.trim();
    if (addr !== '') body.destination_address = addr;
  }
  if (d.vehicleType !== null) body.vehicle_type = d.vehicleType;
  if (d.pricingModel !== null) body.pricing_model = d.pricingModel;
  const n = duration(d);
  if (n !== null) body.duration_value = n;
  if (d.purpose !== null) body.purpose = d.purpose;
  const notes = d.notes.trim();
  if (notes !== '') body.additional_notes = notes;
  return body;
}

/**
 * Who companies reply to: the account's name and phone, or what was typed when the profile has
 * none. `phone` must already be parsed (E.164) or null when the typed one doesn't parse.
 */
export function contactFor(
  profile: { name: string; phone: string | null } | null,
  typed: { name: string; phone: string | null },
  email: string,
): { ok: true; contact: Contact } | { ok: false; missing: ('name' | 'phone')[] } {
  const name = profile?.name.trim() || typed.name.trim();
  const phone = profile?.phone?.trim() || typed.phone;
  const missing: ('name' | 'phone')[] = [];
  if (name === '') missing.push('name');
  if (phone === null || phone === '') missing.push('phone');
  if (phone === null || phone === '' || name === '' || email.trim() === '') {
    return { ok: false, missing };
  }
  return { ok: true, contact: { fullName: name, email: email.trim(), phone } };
}

type PastRequest = {
  tripType: TripType;
  vehicleType: VehicleType | null;
  pickupState: string;
  pickupAddress: string | null;
  destinationState: string | null;
  destinationAddress: string | null;
  pickupDate: IsoDate;
  returnDate: IsoDate;
  pickupTime: string | null;
  passengers: number;
  purpose: string | null;
  notes: string | null;
  pricingModel: PricingModel | null;
};

export type AskAgainChange = 'anyCar' | 'otherDates' | 'otherTrip';

const isPurpose = (p: string | null): p is Purpose => PURPOSES.some((x) => x === p);

/**
 * "Ask again" after no quotes: the old answers, with the one change the customer picked. Dates
 * already past are cleared, so the When step asks again rather than the server refusing them.
 */
export function askAgainDraft(
  r: PastRequest,
  change: AskAgainChange | null,
  today: IsoDate,
): CarDraft {
  const keepDates = change !== 'otherDates' && r.pickupDate >= today;
  const otherTrip: TripType = r.tripType === 'chauffeur' ? 'self_drive' : 'chauffeur';
  return {
    pickupAddress: r.pickupAddress ?? '',
    pickupState: r.pickupState,
    destination:
      r.destinationState === null
        ? null
        : { state: r.destinationState, address: r.destinationAddress ?? '' },
    pickupDate: keepDates ? r.pickupDate : null,
    returnDate: keepDates && r.returnDate !== r.pickupDate ? r.returnDate : null,
    pickupTime: r.pickupTime,
    tripType: change === 'otherTrip' ? otherTrip : r.tripType,
    passengers: Math.min(Math.max(r.passengers, 1), MAX_PASSENGERS),
    vehicleType: change === 'anyCar' ? null : r.vehicleType,
    pricingModel: r.pricingModel,
    durationValue: '',
    purpose: isPurpose(r.purpose) ? r.purpose : null,
    notes: r.notes ?? '',
    urgent: false,
  };
}

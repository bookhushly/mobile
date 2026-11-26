import { MONTHS_LONG, shortDate, stayRange, type IsoDate } from '@/shared/lib/lagosDay';

// Trip planning, the web's version (`app/(user)/plan-trip`, `app/actions/trips.js`): a trip is
// the customer's own checklist of services. Each service is `planned` until a booking or request
// made for it is paid, when the server marks it `booked` (`lib/trips/sync.js`).

/** `trip_services.service_type` values (DB CHECK); don't rename them. */
export const TRIP_SERVICE_TYPES = [
  'hotel',
  'apartment',
  'event',
  'car_rental',
  'logistics',
  'security',
] as const;
export type TripServiceType = (typeof TRIP_SERVICE_TYPES)[number];

export type TripStatus = 'planning' | 'active' | 'completed' | 'cancelled';
export type TripServiceStatus = 'planned' | 'booked' | 'confirmed' | 'cancelled';

export type TripService = { id: string; type: TripServiceType; status: TripServiceStatus };
export type Trip = {
  id: string;
  name: string;
  destination: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  status: TripStatus;
  notes: string | null;
  createdAt: string;
  services: TripService[];
};

type ServiceInfo = {
  type: TripServiceType;
  label: string;
  /** What it is, on the services step and the trip. */
  caption: string;
  /** The trip's button for a service not booked yet. */
  cta: string;
  group: 'instant' | 'quotes';
};

/** The web's two groups and words ("Book instantly", "Get quotes"). */
export const TRIP_SERVICES: readonly ServiceInfo[] = [
  {
    type: 'hotel',
    label: 'Hotel',
    caption: 'Rooms at verified hotels',
    cta: 'Browse hotels',
    group: 'instant',
  },
  {
    type: 'apartment',
    label: 'Apartment',
    caption: 'Serviced short-lets',
    cta: 'Browse apartments',
    group: 'instant',
  },
  {
    type: 'event',
    label: 'Events',
    caption: 'Tickets for shows and venues',
    cta: 'Browse events',
    group: 'instant',
  },
  {
    type: 'car_rental',
    label: 'Car rental',
    caption: 'With a driver or self-drive',
    cta: 'Request a car',
    group: 'quotes',
  },
  {
    type: 'logistics',
    label: 'Logistics',
    caption: 'Deliveries and moving',
    cta: 'Request logistics',
    group: 'quotes',
  },
  {
    type: 'security',
    label: 'Security',
    caption: 'Personal or event security',
    cta: 'Request security',
    group: 'quotes',
  },
];

export function serviceInfo(t: TripServiceType): ServiceInfo {
  const found = TRIP_SERVICES.find((s) => s.type === t);
  if (found !== undefined) return found;
  return { type: t, label: t, caption: '', cta: 'Book', group: 'instant' };
}

export const TRIP_STEPS = ['where', 'when', 'services', 'name'] as const;
export type TripStep = (typeof TRIP_STEPS)[number];

export type TripDraft = {
  destination: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  services: TripServiceType[];
  name: string;
  notes: string;
};

export const EMPTY_TRIP: TripDraft = {
  destination: null,
  startDate: null,
  endDate: null,
  services: [],
  name: '',
  notes: '',
};

export const TRIP_NAME_MAX = 100;
export const TRIP_NOTES_MAX = 1000;

export function tripStepReady(step: TripStep, d: TripDraft): boolean {
  switch (step) {
    case 'where':
    case 'when':
      return true;
    case 'services':
      return d.services.length > 0;
    case 'name':
      return d.services.length > 0 && d.name.trim() !== '';
  }
}

/** The web's suggestion when the name step opens empty. */
export function suggestName(destination: string | null, start: IsoDate | null): string {
  const place = destination === null ? 'My' : destination.replace('FCT ', '');
  if (start === null) return `${place} trip`;
  const month = MONTHS_LONG[Number(start.slice(5, 7)) - 1] ?? '';
  return `${place} trip, ${month}`;
}

export const isBookedService = (s: TripServiceStatus) => s === 'booked' || s === 'confirmed';

export function tripProgress(t: Trip): { booked: number; total: number } {
  return {
    booked: t.services.filter((s) => isBookedService(s.status)).length,
    total: t.services.length,
  };
}

export function missingServices(t: Trip): TripServiceType[] {
  return TRIP_SERVICE_TYPES.filter((type) => !t.services.some((s) => s.type === type));
}

/** The web's "Mark complete": while planning, once every service on it is booked. */
export function canComplete(t: Trip): boolean {
  const p = tripProgress(t);
  return t.status === 'planning' && p.total > 0 && p.booked === p.total;
}

export type LinkTarget = { tripServiceId: string; tripName: string; destination: string | null };

/** Trips a new booking of `type` can join: still planning, with that service still planned. */
export function linkTargets(trips: readonly Trip[], type: TripServiceType): LinkTarget[] {
  const out: LinkTarget[] = [];
  for (const t of trips) {
    if (t.status !== 'planning') continue;
    const s = t.services.find((x) => x.type === type && x.status === 'planned');
    if (s !== undefined)
      out.push({ tripServiceId: s.id, tripName: t.name, destination: t.destination });
  }
  return out;
}

/** The web's quick picks on the Where step. */
export const TRIP_POPULAR = ['Lagos', 'FCT Abuja', 'Rivers', 'Oyo', 'Enugu', 'Akwa Ibom'] as const;

/** The app's state list says "FCT"; the web stores trips as "FCT Abuja". */
export const tripDestinationOf = (state: string): string => (state === 'FCT' ? 'FCT Abuja' : state);

/** A trip's destination as the app's state, for opening results there. */
export const stateOfDestination = (destination: string): string =>
  destination === 'FCT Abuja' ? 'FCT' : destination;

/** "18–22 Dec", "Fri 18 Dec" for a start only, or null with no dates. */
export function tripWhen(start: IsoDate | null, end: IsoDate | null): string | null {
  if (start === null) return null;
  return end === null || end === start ? shortDate(start) : stayRange(start, end);
}

/** The quiet line under a trip: "1 of 2 booked", "All 3 booked". */
export function progressLine(t: Trip): string {
  const { booked, total } = tripProgress(t);
  if (total === 0) return 'Nothing added yet';
  if (booked < total) return `${String(booked)} of ${String(total)} booked`;
  return total === 1 ? 'Booked' : `All ${String(total)} booked`;
}

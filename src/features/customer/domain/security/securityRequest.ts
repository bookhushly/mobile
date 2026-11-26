import type { Contact } from '@/features/customer/domain/carRental/carRequest';
import { isIsoDate, type IsoDate } from '@/shared/lib/lagosDay';

// A security request as the customer builds it (Phase 6, the car rental pattern). Values are the
// web's own (`components/shared/services/security-questionnaire.jsx`, `lib/rfq/schemas.js`); the
// server re-checks all of them.

export const SECURITY_SERVICES = [
  'residential',
  'corporate',
  'event_security',
  'personal_security',
  'escort',
] as const;
export type SecurityService = (typeof SECURITY_SERVICES)[number];

export const DURATIONS = ['hourly', 'daily', 'weekly', 'monthly', 'one_time', 'ongoing'] as const;
export type Duration = (typeof DURATIONS)[number];

export const GUARD_TYPES = ['unarmed', 'armed', 'both'] as const;
export type GuardType = (typeof GUARD_TYPES)[number];

export const SHIFTS = ['day', 'night', '24_hours', 'rotating'] as const;
export type Shift = (typeof SHIFTS)[number];

export const PROPERTY_TYPES = ['residential', 'commercial', 'industrial', 'mixed'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_SIZES = ['small', 'medium', 'large', 'estate'] as const;
export type PropertySize = (typeof PROPERTY_SIZES)[number];

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const SECURITY_STEPS = [
  'service',
  'where',
  'when',
  'team',
  'bring',
  'details',
  'check',
] as const;
export type SecurityStep = (typeof SECURITY_STEPS)[number];

export const MAX_GUARDS = 500;
export const NOTES_MAX = 1000;

/** Services about a place (property questions apply). */
export const isPropertyService = (s: SecurityService | null) =>
  s === 'residential' || s === 'corporate';

export type SecurityDraft = {
  service: SecurityService | null;
  address: string;
  landmark: string;
  state: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  /** `HH:MM`; null = any time. */
  startTime: string | null;
  duration: Duration | null;
  shift: Shift | null;
  guards: number;
  guardType: GuardType | null;
  canine: boolean;
  vehicle: boolean;
  /** Events. */
  eventType: string;
  attendance: string;
  eventHours: string;
  vip: boolean;
  /** Homes and businesses. */
  propertyType: PropertyType | null;
  propertySize: PropertySize | null;
  entrances: string;
  cctv: boolean;
  alarm: boolean;
  /** Everyone. */
  risk: RiskLevel | null;
  incidents: boolean;
  incidentDetails: string;
  backgroundCheck: boolean;
  uniform: boolean;
  radios: boolean;
  notes: string;
};

export const EMPTY_SECURITY: SecurityDraft = {
  service: null,
  address: '',
  landmark: '',
  state: null,
  startDate: null,
  endDate: null,
  startTime: null,
  duration: null,
  shift: null,
  guards: 1,
  guardType: null,
  canine: false,
  vehicle: false,
  eventType: '',
  attendance: '',
  eventHours: '',
  vip: false,
  propertyType: null,
  propertySize: null,
  entrances: '',
  cctv: false,
  alarm: false,
  risk: null,
  incidents: false,
  incidentDetails: '',
  // On by default, as on the web form and in the table (`DEFAULT true`): a customer who skips the
  // details step asks for what a web request asks for.
  backgroundCheck: true,
  uniform: true,
  radios: true,
  notes: '',
};

/** The most the app sends for a typed count (the database's integer columns overflow far above). */
export const COUNT_MAX = 100_000;

/** A typed whole number from 1 to COUNT_MAX: null when blank; NaN when it isn't one. */
export function count(raw: string): number | null {
  const t = raw.replace(/[,\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= COUNT_MAX ? n : Number.NaN;
}

const MIN_ADDRESS = 3;

export function securityStepReady(step: SecurityStep, d: SecurityDraft, today: IsoDate): boolean {
  switch (step) {
    case 'service':
      return d.service !== null;
    case 'where':
      return d.state !== null && d.address.trim().length >= MIN_ADDRESS;
    case 'when':
      return (
        d.startDate !== null &&
        isIsoDate(d.startDate) &&
        d.startDate >= today &&
        (d.endDate === null || d.endDate >= d.startDate)
      );
    case 'team':
      return (
        d.duration !== null &&
        d.guardType !== null &&
        Number.isInteger(d.guards) &&
        d.guards >= 1 &&
        d.guards <= MAX_GUARDS
      );
    case 'bring':
      return true;
    case 'details': {
      // Only the questions shown for this service count (a hidden answer must never block Send).
      const event = d.service === 'event_security';
      const property = isPropertyService(d.service);
      return (
        (!event || !Number.isNaN(count(d.attendance) ?? 0)) &&
        (!event || !Number.isNaN(count(d.eventHours) ?? 0)) &&
        (!property || !Number.isNaN(count(d.entrances) ?? 0)) &&
        d.notes.trim().length <= NOTES_MAX &&
        d.incidentDetails.trim().length <= NOTES_MAX
      );
    }
    case 'check':
      return SECURITY_STEPS.every((s) => s === 'check' || securityStepReady(s, d, today));
  }
}

export type SecurityBody = {
  service_type: SecurityService;
  full_name: string;
  email: string;
  phone: string;
  service_address: string;
  landmark?: string;
  state: string;
  start_date: IsoDate;
  end_date?: IsoDate;
  start_time?: string;
  duration_type: Duration;
  number_of_guards: number;
  guard_type: GuardType;
  requires_canine: boolean;
  requires_vehicle: boolean;
  shift_pattern?: Shift;
  event_type?: string;
  expected_attendance?: number;
  event_duration_hours?: number;
  vip_protection?: boolean;
  property_type?: PropertyType;
  property_size?: PropertySize;
  number_of_entrances?: number;
  has_cctv?: boolean;
  has_alarm_system?: boolean;
  risk_level?: RiskLevel;
  previous_incidents: boolean;
  incident_details?: string;
  requires_background_check: boolean;
  requires_uniform: boolean;
  requires_communication_device: boolean;
  special_instructions?: string;
};

/**
 * The body for `POST /api/security/requests`, or null while something required is missing. Event
 * answers go only with an event, property answers only with a home or business.
 */
export function securityBody(d: SecurityDraft, c: Contact, today: IsoDate): SecurityBody | null {
  if (!securityStepReady('check', d, today)) return null;
  const name = c.fullName.trim();
  const email = c.email.trim();
  const phone = c.phone.trim();
  if (name === '' || email === '' || phone === '') return null;
  // securityStepReady('check') has proven these.
  if (
    d.service === null ||
    d.state === null ||
    d.startDate === null ||
    d.duration === null ||
    d.guardType === null
  ) {
    return null;
  }
  const body: SecurityBody = {
    service_type: d.service,
    full_name: name,
    email,
    phone,
    service_address: d.address.trim(),
    state: d.state,
    start_date: d.startDate,
    duration_type: d.duration,
    number_of_guards: d.guards,
    guard_type: d.guardType,
    requires_canine: d.canine,
    requires_vehicle: d.vehicle,
    previous_incidents: d.incidents,
    requires_background_check: d.backgroundCheck,
    requires_uniform: d.uniform,
    requires_communication_device: d.radios,
  };
  const landmark = d.landmark.trim();
  if (landmark !== '') body.landmark = landmark;
  if (d.endDate !== null) body.end_date = d.endDate;
  if (d.startTime !== null) body.start_time = d.startTime;
  if (d.shift !== null) body.shift_pattern = d.shift;
  if (d.risk !== null) body.risk_level = d.risk;
  if (d.service === 'event_security') {
    const type = d.eventType.trim();
    if (type !== '') body.event_type = type;
    const people = count(d.attendance);
    if (people !== null) body.expected_attendance = people;
    const hours = count(d.eventHours);
    if (hours !== null) body.event_duration_hours = hours;
    body.vip_protection = d.vip;
  }
  if (isPropertyService(d.service)) {
    if (d.propertyType !== null) body.property_type = d.propertyType;
    if (d.propertySize !== null) body.property_size = d.propertySize;
    const doors = count(d.entrances);
    if (doors !== null) body.number_of_entrances = doors;
    body.has_cctv = d.cctv;
    body.has_alarm_system = d.alarm;
  }
  const details = d.incidentDetails.trim();
  if (d.incidents && details !== '') body.incident_details = details;
  const notes = d.notes.trim();
  if (notes !== '') body.special_instructions = notes;
  return body;
}

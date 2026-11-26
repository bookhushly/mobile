import { z } from 'zod';

import {
  DURATIONS,
  GUARD_TYPES,
  PROPERTY_SIZES,
  PROPERTY_TYPES,
  RISK_LEVELS,
  SECURITY_SERVICES,
  SHIFTS,
  type Duration,
  type GuardType,
  type PropertySize,
  type PropertyType,
  type RiskLevel,
  type SecurityService,
  type Shift,
} from '@/features/customer/domain/security/securityRequest';
import { plainText } from '@/features/customer/domain/plainText';
import {
  REQUEST_STATUSES,
  bool,
  num,
  offer,
  str,
  time,
  type CarOffer,
  type RequestStatus,
} from '@/features/customer/schemas/carRental';

// `/api/security/requests…` (web `docs/mobile/RFQ_API.md`). Same rules as car rental and
// logistics. Security offers carry no vehicle or driver (web `offerSelect`).

export type SecurityDetails = {
  eventType: string;
  attendance: string;
  eventHours: string;
  vip: boolean;
  propertyType: PropertyType | null;
  propertySize: PropertySize | null;
  entrances: string;
  cctv: boolean;
  alarm: boolean;
  risk: RiskLevel | null;
  incidents: boolean;
  incidentDetails: string;
  backgroundCheck: boolean;
  uniform: boolean;
  radios: boolean;
};

export type SecurityRequest = {
  id: string;
  status: RequestStatus;
  service: SecurityService;
  address: string;
  landmark: string | null;
  /** The shared request fields (RfqRow): the start date and the state. */
  pickupDate: string;
  pickupState: string;
  endDate: string | null;
  startTime: string | null;
  duration: Duration | null;
  guards: number;
  guardType: GuardType | null;
  shift: Shift | null;
  canine: boolean;
  vehicle: boolean;
  notes: string | null;
  /** The optional details, kept so "Ask again" can send them again. */
  details: SecurityDetails;
  expiresAt: string | null;
  createdAt: string;
  vendorCompletedAt: string | null;
  offerCount: number;
  selectedVendor: { id: string; name: string; phone: string | null } | null;
  selectedOffer: CarOffer | null;
  offers: CarOffer[];
};

export const securityRequest = z
  .object({
    id: z.string(),
    status: z.enum(REQUEST_STATUSES),
    service_type: z.enum(SECURITY_SERVICES),
    service_address: z.string(),
    landmark: str,
    state: z.string(),
    start_date: z.string(),
    end_date: str,
    start_time: time,
    duration_type: z.enum(DURATIONS).nullable().optional().catch(null),
    number_of_guards: num,
    guard_type: z.enum(GUARD_TYPES).nullable().optional().catch(null),
    shift_pattern: z.enum(SHIFTS).nullable().optional().catch(null),
    requires_canine: bool,
    requires_vehicle: bool,
    special_instructions: str,
    event_type: str,
    expected_attendance: num,
    event_duration_hours: num,
    vip_protection: bool,
    property_type: z.enum(PROPERTY_TYPES).nullable().optional().catch(null),
    property_size: z.enum(PROPERTY_SIZES).nullable().optional().catch(null),
    number_of_entrances: num,
    has_cctv: bool,
    has_alarm_system: bool,
    risk_level: z.enum(RISK_LEVELS).nullable().optional().catch(null),
    previous_incidents: bool,
    incident_details: str,
    requires_background_check: bool,
    requires_uniform: bool,
    requires_communication_device: bool,
    expires_at: str,
    created_at: z.string(),
    vendor_completed_at: str,
    offer_count: num,
    selected_vendor: z
      .object({ id: z.string(), business_name: str, phone_number: str })
      .nullable()
      .optional()
      .catch(null),
    selected_offer: offer.nullable().optional().catch(null),
    vendor_offers: z.array(z.unknown()).optional().catch([]),
  })
  .transform((r): SecurityRequest => {
    const offers = (r.vendor_offers ?? []).flatMap((o) => {
      const p = offer.safeParse(o);
      return p.success ? [p.data] : [];
    });
    return {
      id: r.id,
      status: r.status,
      service: r.service_type,
      address: r.service_address,
      landmark: r.landmark ?? null,
      pickupDate: r.start_date,
      pickupState: r.state,
      endDate: r.end_date ?? null,
      startTime: r.start_time,
      duration: r.duration_type ?? null,
      guards: Math.max(1, Math.trunc(r.number_of_guards ?? 1)),
      guardType: r.guard_type ?? null,
      shift: r.shift_pattern ?? null,
      canine: r.requires_canine === true,
      vehicle: r.requires_vehicle === true,
      notes: plainText(r.special_instructions ?? null),
      details: {
        eventType: r.event_type ?? '',
        attendance: r.expected_attendance == null ? '' : String(r.expected_attendance),
        eventHours: r.event_duration_hours == null ? '' : String(r.event_duration_hours),
        vip: r.vip_protection === true,
        propertyType: r.property_type ?? null,
        propertySize: r.property_size ?? null,
        entrances: r.number_of_entrances == null ? '' : String(r.number_of_entrances),
        cctv: r.has_cctv === true,
        alarm: r.has_alarm_system === true,
        risk: r.risk_level ?? null,
        incidents: r.previous_incidents === true,
        incidentDetails: r.incident_details ?? '',
        // The table defaults these to true; a missing value reads as the default.
        backgroundCheck: r.requires_background_check !== false,
        uniform: r.requires_uniform !== false,
        radios: r.requires_communication_device !== false,
      },
      expiresAt: r.expires_at ?? null,
      createdAt: r.created_at,
      vendorCompletedAt: r.vendor_completed_at ?? null,
      offerCount:
        r.vendor_offers === undefined
          ? (r.offer_count ?? 0)
          : offers.filter((o) => o.status === 'pending').length,
      selectedVendor:
        r.selected_vendor == null
          ? null
          : {
              id: r.selected_vendor.id,
              name: r.selected_vendor.business_name ?? 'Security company',
              phone: r.selected_vendor.phone_number ?? null,
            },
      selectedOffer: r.selected_offer ?? null,
      offers,
    };
  });

export const securityList = z
  .object({ requests: z.array(z.unknown()), count: z.coerce.number().catch(0) })
  .transform((b) => ({
    requests: b.requests.flatMap((x) => {
      const p = securityRequest.safeParse(x);
      return p.success ? [p.data] : [];
    }),
    count: b.count,
  }));

export const securityDetail = z.object({ request: securityRequest }).transform((b) => b.request);

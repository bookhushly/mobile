import type {
  MyOffer,
  RequestDetail,
  Vehicle,
  VendorRequest,
} from '@/features/vendor/domain/requests';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import type { ApiError } from '@/shared/lib/errors';
import { lagosToday, shortDate } from '@/shared/lib/lagosDay';
import { err, ok, type Result } from '@/shared/lib/result';

// SAMPLE DATA (vendor mode is dev-only until the web vendor routes ship; plan slice 8 swaps each
// read for HTTP). Quotes sent in this session are kept in memory so the screens behave as they
// will: a sent quote moves the request to Quoted, a withdrawn one moves it back.

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const day = (nowMs: number, days: number) => lagosToday(nowMs + days * 24 * HOUR);

type Base = Omit<RequestDetail, 'myOffer' | 'closesAt'> & { closesIn: number; offer?: MyOffer };

function logistics(nowMs: number): Base[] {
  return [
    {
      id: 'sample-req-1',
      requestType: 'logistics',
      title: 'Move a 2-bed flat',
      summary: `Lekki → Yaba · ${shortDate(day(nowMs, 7))}`,
      closesIn: 5 * HOUR,
      quotes: 2,
      photo: 'truck',
      from: 'Admiralty Way, Lekki Phase 1',
      to: 'Herbert Macaulay Way, Yaba',
      start: { label: 'Pick-up', date: day(nowMs, 7), time: '09:00' },
      end: { label: 'Arrive by', value: 'Same day', detail: 'any time' },
      facts: [
        { icon: 'package', title: 'Furniture, 2 bedrooms', detail: 'Fragile items: TV, mirrors' },
        { icon: 'truck', title: 'Small truck', detail: 'Needs 2 loaders' },
      ],
      note: 'Third floor, no lift at the old place.',
    },
    {
      id: 'sample-req-2',
      requestType: 'logistics',
      title: 'Deliver 4 boxes',
      summary: `Ikeja → Ajah · ${shortDate(day(nowMs, 2))}`,
      closesIn: 22 * HOUR,
      quotes: 0,
      photo: 'van',
      from: 'Allen Avenue, Ikeja',
      to: 'Abraham Adesanya, Ajah',
      start: { label: 'Pick-up', date: day(nowMs, 2), time: null },
      end: null,
      facts: [
        { icon: 'package', title: '4 boxes, about 60 kg', detail: null },
        { icon: 'truck', title: 'Van', detail: null },
      ],
      note: null,
    },
    {
      id: 'sample-req-3',
      requestType: 'logistics',
      title: 'Office furniture',
      summary: `Ikoyi → Surulere · ${shortDate(day(nowMs, 4))}`,
      closesIn: 40 * HOUR,
      quotes: 1,
      photo: 'delivery',
      from: 'Kingsway Road, Ikoyi',
      to: 'Adeniran Ogunsanya, Surulere',
      start: { label: 'Pick-up', date: day(nowMs, 4), time: '08:00' },
      end: null,
      facts: [{ icon: 'package', title: '12 desks and chairs', detail: 'Flat-packed' }],
      note: null,
    },
    {
      id: 'sample-req-4',
      requestType: 'logistics',
      title: 'Fridge to Ikorodu',
      summary: `Yaba → Ikorodu · ${shortDate(day(nowMs, 3))}`,
      closesIn: 30 * HOUR,
      quotes: 3,
      photo: 'van',
      from: 'Herbert Macaulay Way, Yaba',
      to: 'Lagos Road, Ikorodu',
      start: { label: 'Pick-up', date: day(nowMs, 3), time: null },
      end: null,
      facts: [{ icon: 'package', title: 'One fridge', detail: 'Upright, 180 cm' }],
      note: null,
      offer: {
        id: 'sample-offer-4',
        amount: 28_000,
        status: 'pending',
        sentAt: iso(nowMs - 3 * HOUR),
      },
    },
    {
      id: 'sample-req-5',
      requestType: 'logistics',
      title: 'Move a 2-bed flat',
      summary: `Lekki → Yaba · ${shortDate(day(nowMs, 0))}`,
      closesIn: -24 * HOUR,
      quotes: 4,
      photo: 'moving',
      from: 'Admiralty Way, Lekki Phase 1',
      to: 'Herbert Macaulay Way, Yaba',
      start: { label: 'Pick-up', date: day(nowMs, 0), time: '09:00' },
      end: null,
      facts: [{ icon: 'package', title: 'Furniture, 2 bedrooms', detail: null }],
      note: null,
      offer: {
        id: 'sample-offer-5',
        amount: 85_000,
        status: 'accepted',
        sentAt: iso(nowMs - 72 * HOUR),
      },
    },
  ];
}

function carRental(nowMs: number): Base[] {
  return [
    {
      id: 'sample-req-1',
      requestType: 'car_rental',
      title: 'SUV for 3 days, self-drive',
      summary: `Lagos · ${shortDate(day(nowMs, 6))}`,
      closesIn: 7 * HOUR,
      quotes: 3,
      photo: 'suv',
      from: 'Lekki Phase 1, Lagos',
      to: null,
      start: { label: 'Pick-up', date: day(nowMs, 6), time: '10:00' },
      end: { label: 'Return', value: shortDate(day(nowMs, 9)), detail: '10:00' },
      facts: [
        { icon: 'car', title: 'SUV, self-drive', detail: '5 seats' },
        { icon: 'users', title: '4 people', detail: 'Family trip' },
      ],
      note: null,
    },
    {
      id: 'sample-req-2',
      requestType: 'car_rental',
      title: 'Wedding convoy, 4 cars',
      summary: `Ikoyi · ${shortDate(day(nowMs, 14))}`,
      closesIn: 30 * HOUR,
      quotes: 1,
      photo: 'sedan',
      from: 'Ikoyi, Lagos',
      to: 'Eko Hotel, Victoria Island',
      start: { label: 'Pick-up', date: day(nowMs, 14), time: '11:00' },
      end: null,
      facts: [{ icon: 'car', title: '4 sedans, with drivers', detail: 'Black or white' }],
      note: 'Cars must be clean and decorated by 10:30.',
    },
  ];
}

function security(nowMs: number): Base[] {
  return [
    {
      id: 'sample-req-1',
      requestType: 'security',
      title: 'Night guards for an office',
      summary: `Ikeja · from ${shortDate(day(nowMs, 2))}`,
      closesIn: 12 * HOUR,
      quotes: 2,
      photo: 'security',
      from: 'Obafemi Awolowo Way, Ikeja',
      to: null,
      start: { label: 'Start', date: day(nowMs, 2), time: '19:00' },
      end: { label: 'How long', value: 'Monthly', detail: 'ongoing' },
      facts: [
        { icon: 'shield', title: '2 unarmed guards', detail: 'Night shift' },
        { icon: 'note', title: 'Background-checked, in uniform, with radios', detail: null },
      ],
      note: null,
    },
  ];
}

function base(kind: ServedKind, nowMs: number): Base[] {
  switch (kind) {
    case 'carRental':
      return carRental(nowMs);
    case 'security':
      return security(nowMs);
    case 'logistics':
    case 'hotel':
    case 'apartment':
    case 'event':
      return logistics(nowMs);
  }
}

// Quotes sent or withdrawn in this session, keyed by request id (null = withdrawn).
const sent = new Map<string, MyOffer>();

function detail(b: Base, nowMs: number): RequestDetail {
  const { closesIn, offer, ...rest } = b;
  return { ...rest, closesAt: iso(nowMs + closesIn), myOffer: sent.get(b.id) ?? offer ?? null };
}

export function sampleRequests(kind: ServedKind, nowMs: number): VendorRequest[] {
  return base(kind, nowMs).map((b) => {
    const d = detail(b, nowMs);
    return {
      id: d.id,
      requestType: d.requestType,
      title: d.title,
      summary: d.summary,
      closesAt: d.closesAt,
      quotes: d.quotes,
      photo: d.photo,
      myOffer: d.myOffer,
    };
  });
}

export function sampleRequest(
  kind: ServedKind,
  id: string,
  nowMs: number,
): Result<RequestDetail, ApiError> {
  const b = base(kind, nowMs).find((x) => x.id === id);
  return b === undefined ? err({ kind: 'notFound' }) : ok(detail(b, nowMs));
}

export function sampleVehicles(kind: ServedKind): Vehicle[] {
  if (kind === 'carRental')
    return [
      { id: 'v-1', name: 'Toyota Highlander 2021', detail: 'LND 214 KJ · 7 seats', photo: 'suv' },
      { id: 'v-2', name: 'Toyota Camry 2020', detail: 'KJA 902 AB · 5 seats', photo: 'sedan' },
    ];
  if (kind === 'logistics')
    return [
      { id: 'v-1', name: 'Isuzu NPR', detail: 'KJA 482 XY · 3.5 tonnes', photo: 'truck' },
      { id: 'v-2', name: 'Toyota HiAce', detail: 'LSR 118 EP · van', photo: 'van' },
    ];
  return [];
}

export function sampleSendQuote(
  kind: ServedKind,
  id: string,
  amount: number,
  nowMs: number,
): Result<MyOffer, ApiError> {
  const r = sampleRequest(kind, id, nowMs);
  if (!r.ok) return r;
  if (Date.parse(r.value.closesAt) <= nowMs)
    return err({ kind: 'conflict', code: 'request_not_open' });
  if (r.value.myOffer?.status === 'pending')
    return err({ kind: 'conflict', code: 'already_offered' });
  const offer: MyOffer = {
    id: `sample-offer-${id}`,
    amount,
    status: 'pending',
    sentAt: iso(nowMs),
  };
  sent.set(id, offer);
  return ok(offer);
}

export function sampleWithdraw(
  kind: ServedKind,
  id: string,
  nowMs: number,
): Result<MyOffer, ApiError> {
  const r = sampleRequest(kind, id, nowMs);
  if (!r.ok) return r;
  const o = r.value.myOffer;
  if (o === null || o.status !== 'pending')
    return err({ kind: 'conflict', code: 'offer_not_pending' });
  const withdrawn: MyOffer = { ...o, status: 'withdrawn' };
  sent.set(id, withdrawn);
  return ok(withdrawn);
}

/** Bookhushly's fee on a quote. The web's default; the real rate will come from the server. */
export const SAMPLE_FEE_RATE = 0.1;

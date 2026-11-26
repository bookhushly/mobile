import { nextStep, type Milestone, type VendorJob } from '@/features/vendor/domain/jobs';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

// SAMPLE DATA (vendor mode is dev-only until the web vendor routes ship). Changes made in this
// session are kept in memory, so start → picked up → on the way → delivered plays through.

const MIN = 60_000;
const HOUR = 60 * MIN;
const iso = (ms: number) => new Date(ms).toISOString();
const none = { pickedUpAt: null, inTransitAt: null, deliveredAt: null };

function logistics(nowMs: number): VendorJob[] {
  return [
    {
      id: 'sample-job-1',
      requestType: 'logistics',
      title: 'Move a 2-bed flat',
      startsAt: iso(nowMs + 40 * MIN),
      from: 'Admiralty Way, Lekki Phase 1',
      to: 'Herbert Macaulay Way, Yaba',
      toShort: 'Yaba',
      customer: { name: 'Ada Okafor', phone: '+2340000000000' },
      paid: 85_000,
      payout: 76_500,
      status: 'paid',
      vendorCompletedAt: null,
      milestones: none,
      photo: 'moving',
    },
    {
      id: 'sample-job-2',
      requestType: 'logistics',
      title: 'Parcel to Victoria Island',
      startsAt: iso(nowMs - 30 * MIN),
      from: 'Allen Avenue, Ikeja',
      to: 'Adeola Odeku Street, V.I.',
      toShort: 'Victoria Island',
      customer: { name: 'Kunle Adebayo', phone: '+2340000000000' },
      paid: 25_000,
      payout: 22_500,
      status: 'in_progress',
      vendorCompletedAt: null,
      milestones: { pickedUpAt: iso(nowMs - 20 * MIN), inTransitAt: null, deliveredAt: null },
      photo: 'courier',
    },
    {
      id: 'sample-job-3',
      requestType: 'logistics',
      title: 'Deliver 4 boxes',
      startsAt: iso(nowMs + 2 * 24 * HOUR),
      from: 'Allen Avenue, Ikeja',
      to: 'Abraham Adesanya, Ajah',
      toShort: 'Ajah',
      customer: { name: 'Tolu Adeyemi', phone: null },
      paid: 30_000,
      payout: 27_000,
      status: 'matched',
      vendorCompletedAt: null,
      milestones: none,
      photo: 'van',
    },
    {
      id: 'sample-job-4',
      requestType: 'logistics',
      title: 'Fridge to Ikorodu',
      startsAt: iso(nowMs - 3 * 24 * HOUR),
      from: 'Herbert Macaulay Way, Yaba',
      to: 'Lagos Road, Ikorodu',
      toShort: 'Ikorodu',
      customer: { name: 'Bisi Kalu', phone: '+2340000000000' },
      paid: 28_000,
      payout: 25_200,
      status: 'completed',
      vendorCompletedAt: iso(nowMs - 3 * 24 * HOUR + 3 * HOUR),
      milestones: {
        pickedUpAt: iso(nowMs - 3 * 24 * HOUR + HOUR),
        inTransitAt: iso(nowMs - 3 * 24 * HOUR + HOUR),
        deliveredAt: iso(nowMs - 3 * 24 * HOUR + 3 * HOUR),
      },
      photo: 'van',
    },
  ];
}

function carRental(nowMs: number): VendorJob[] {
  return [
    {
      id: 'sample-job-1',
      requestType: 'car_rental',
      title: 'Airport pick-up, with driver',
      startsAt: iso(nowMs + 90 * MIN),
      from: 'Murtala Muhammed Airport, Ikeja',
      to: 'Eko Hotel, Victoria Island',
      toShort: 'Victoria Island',
      customer: { name: 'Bisi Kalu', phone: '+2340000000000' },
      paid: 50_000,
      payout: 45_000,
      status: 'paid',
      vendorCompletedAt: null,
      milestones: none,
      photo: 'withDriver',
    },
  ];
}

function security(nowMs: number): VendorJob[] {
  return [
    {
      id: 'sample-job-1',
      requestType: 'security',
      title: '4 guards, wedding reception',
      startsAt: iso(nowMs + 3 * HOUR),
      from: 'Harbour Point, Victoria Island',
      to: null,
      toShort: null,
      customer: { name: 'Chiamaka Eze', phone: '+2340000000000' },
      paid: 200_000,
      payout: 180_000,
      status: 'paid',
      vendorCompletedAt: null,
      milestones: none,
      photo: 'security',
    },
  ];
}

function base(kind: ServedKind, nowMs: number): VendorJob[] {
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

// Jobs changed in this session, keyed by id.
const changed = new Map<string, VendorJob>();

export function sampleJobs(kind: ServedKind, nowMs: number): VendorJob[] {
  return base(kind, nowMs).map((j) => changed.get(j.id) ?? j);
}

export function sampleJob(
  kind: ServedKind,
  id: string,
  nowMs: number,
): Result<VendorJob, ApiError> {
  const j = sampleJobs(kind, nowMs).find((x) => x.id === id);
  return j === undefined ? err({ kind: 'notFound' }) : ok(j);
}

const wrongStatus = (j: VendorJob) =>
  err<ApiError>({ kind: 'conflict', code: 'wrong_status', body: { status: j.status } });

export function sampleStart(
  kind: ServedKind,
  id: string,
  nowMs: number,
): Result<VendorJob, ApiError> {
  const r = sampleJob(kind, id, nowMs);
  if (!r.ok) return r;
  if (nextStep(r.value)?.kind !== 'start') return wrongStatus(r.value);
  const j: VendorJob = { ...r.value, status: 'in_progress' };
  changed.set(id, j);
  return ok(j);
}

export function sampleMilestone(
  kind: ServedKind,
  id: string,
  milestone: Milestone,
  photoUri: string | null,
  nowMs: number,
): Result<VendorJob, ApiError> {
  const r = sampleJob(kind, id, nowMs);
  if (!r.ok) return r;
  const step = nextStep(r.value);
  if (step?.kind !== 'milestone' || step.milestone !== milestone) return wrongStatus(r.value);
  if (milestone === 'delivered' && photoUri === null)
    return err({ kind: 'conflict', code: 'photo_required' });
  const at = iso(nowMs);
  const m = r.value.milestones;
  const j: VendorJob = {
    ...r.value,
    milestones:
      milestone === 'picked_up'
        ? { ...m, pickedUpAt: at }
        : milestone === 'in_transit'
          ? { ...m, inTransitAt: at }
          : { ...m, deliveredAt: at },
    // Delivered completes the job, as on the web.
    vendorCompletedAt: milestone === 'delivered' ? at : r.value.vendorCompletedAt,
  };
  changed.set(id, j);
  return ok(j);
}

export function sampleComplete(
  kind: ServedKind,
  id: string,
  nowMs: number,
): Result<VendorJob, ApiError> {
  const r = sampleJob(kind, id, nowMs);
  if (!r.ok) return r;
  // Idempotent, as the web route will be: already marked done answers with the job.
  if (r.value.vendorCompletedAt !== null) return ok(r.value);
  if (nextStep(r.value)?.kind !== 'complete') return wrongStatus(r.value);
  const j: VendorJob = { ...r.value, vendorCompletedAt: iso(nowMs) };
  changed.set(id, j);
  return ok(j);
}

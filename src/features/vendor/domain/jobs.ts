import { formatNaira } from '@/shared/lib/formatNaira';
import { lagosToday, shortDate, type IsoDate } from '@/shared/lib/lagosDay';

import type { PhotoKey, RequestType } from './today';

// A job: a request whose customer chose this vendor (plan slice 4). The web's statuses
// (`*_requests.status`) are kept as they are; everything shown is derived here.

export type JobStatus = 'matched' | 'paid' | 'in_progress' | 'completed' | 'disputed';
export type Milestone = 'picked_up' | 'in_transit' | 'delivered';

export type VendorJob = {
  id: string;
  requestType: RequestType;
  title: string;
  startsAt: string;
  from: string;
  to: string | null;
  /** The destination's short name for the headline ("Yaba"). */
  toShort: string | null;
  /** The phone is null until the customer has paid (the web never sends it before). */
  customer: { name: string; phone: string | null };
  /** What the customer paid, and what the vendor receives after the fee (naira). */
  paid: number;
  payout: number;
  status: JobStatus;
  vendorCompletedAt: string | null;
  /** Logistics only; the others stay null. */
  milestones: { pickedUpAt: string | null; inTransitAt: string | null; deliveredAt: string | null };
  photo: PhotoKey;
};

export type JobStage =
  'awaitingPayment' | 'ready' | 'running' | 'awaitingConfirm' | 'done' | 'disputed';

export function jobStage(j: VendorJob): JobStage {
  switch (j.status) {
    case 'matched':
      return 'awaitingPayment';
    case 'paid':
      return 'ready';
    case 'in_progress':
      return j.vendorCompletedAt === null ? 'running' : 'awaitingConfirm';
    case 'completed':
      return 'done';
    case 'disputed':
      return 'disputed';
  }
}

export type NextStep =
  { kind: 'start' } | { kind: 'milestone'; milestone: Milestone } | { kind: 'complete' };

/** The one thing to do next, or null when it's the customer's (or Bookhushly's) move. */
export function nextStep(j: VendorJob): NextStep | null {
  const stage = jobStage(j);
  if (stage === 'ready') return { kind: 'start' };
  if (stage !== 'running') return null;
  if (j.requestType !== 'logistics') return { kind: 'complete' };
  // Delivered recorded but the completion step failed (web VENDOR_API.md): finish it with Mark
  // done; sending delivered again is refused.
  if (j.milestones.deliveredAt !== null) return { kind: 'complete' };
  if (j.milestones.pickedUpAt === null) return { kind: 'milestone', milestone: 'picked_up' };
  if (j.milestones.inTransitAt === null) return { kind: 'milestone', milestone: 'in_transit' };
  return { kind: 'milestone', milestone: 'delivered' };
}

export function jobProgress(j: VendorJob): { label: string; done: boolean }[] {
  const stage = jobStage(j);
  const paid = stage !== 'awaitingPayment';
  const finished = stage === 'awaitingConfirm' || stage === 'done';
  if (j.requestType === 'logistics') {
    const m = j.milestones;
    return [
      { label: 'Paid', done: paid },
      { label: 'Picked up', done: m.pickedUpAt !== null },
      { label: 'On the way', done: m.inTransitAt !== null },
      { label: 'Delivered', done: m.deliveredAt !== null || finished },
    ];
  }
  return [
    { label: 'Paid', done: paid },
    { label: 'Started', done: stage === 'running' || finished || stage === 'disputed' },
    { label: 'Done', done: finished },
  ];
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function jobHeadline(j: VendorJob): string {
  switch (jobStage(j)) {
    case 'awaitingPayment':
      return 'Waiting for payment';
    case 'ready':
      return 'Ready to start';
    case 'running': {
      if (j.requestType !== 'logistics') return 'On the job';
      if (j.milestones.pickedUpAt === null) return 'Go to the pick-up';
      if (j.milestones.inTransitAt === null) return 'Picked up';
      return j.toShort === null ? 'On the way' : `On the way to ${j.toShort}`;
    }
    case 'awaitingConfirm':
      return `Waiting for ${firstName(j.customer.name)} to confirm`;
    case 'done':
      return 'Done and paid';
    case 'disputed':
      return 'On hold';
  }
}

/** Where the vendor's money is; null before the customer has paid. */
export function heldLine(j: VendorJob): string | null {
  const amount = formatNaira(j.payout);
  const who = firstName(j.customer.name);
  switch (jobStage(j)) {
    case 'awaitingPayment':
      return null;
    case 'done':
      return `${amount} was added to your wallet.`;
    case 'disputed':
      return `${amount} stays held while Bookhushly looks into ${who}’s report.`;
    case 'ready':
    case 'running':
    case 'awaitingConfirm':
      return `${amount} is held for you. It’s released when ${who} confirms the job’s done.`;
  }
}

export type JobTab = 'upcoming' | 'running' | 'done';

export function splitJobs(jobs: readonly VendorJob[]): Record<JobTab, VendorJob[]> {
  const out: Record<JobTab, VendorJob[]> = { upcoming: [], running: [], done: [] };
  for (const j of jobs) {
    const s = jobStage(j);
    if (s === 'awaitingPayment' || s === 'ready') out.upcoming.push(j);
    else if (s === 'done') out.done.push(j);
    else out.running.push(j);
  }
  return out;
}

const DAY = 86_400_000;

/** Jobs grouped by Lagos day, earliest first: "Today", "Tomorrow", then "Thu 3 Dec". */
export function groupByDay(
  jobs: readonly VendorJob[],
  nowMs: number,
): { day: IsoDate; label: string; jobs: VendorJob[] }[] {
  const today = lagosToday(nowMs);
  const tomorrow = lagosToday(nowMs + DAY);
  const sorted = [...jobs].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const groups: { day: IsoDate; label: string; jobs: VendorJob[] }[] = [];
  for (const j of sorted) {
    const day = lagosToday(Date.parse(j.startsAt));
    let g = groups.find((x) => x.day === day);
    if (g === undefined) {
      const label = day === today ? 'Today' : day === tomorrow ? 'Tomorrow' : shortDate(day);
      g = { day, label, jobs: [] };
      groups.push(g);
    }
    g.jobs.push(j);
  }
  return groups;
}

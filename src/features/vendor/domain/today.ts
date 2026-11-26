// The request-for-quote vendor's Today (design v13): what needs them, the next job, the month.
// Pure: times come in as ISO strings and an injected `now` (server clock).

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const LAGOS_OFFSET_MS = HOUR;

export type RequestType = 'car_rental' | 'logistics' | 'security';

/** A paid job's place in its day. `done` jobs never lead Today. */
export type JobStage = 'paid' | 'inProgress' | 'done';

export type TodayJob = {
  id: string;
  requestType: RequestType;
  title: string;
  startsAt: string;
  from: string;
  /** Null for work in one place (security, a chauffeur's day). */
  to: string | null;
  customerName: string;
  /** What the vendor receives, after the fee (naira). */
  payout: number;
  stage: JobStage;
  photo: PhotoKey;
};

/** A request still taking quotes, as the vendor sees it (no customer contact details). */
export type OpenRequest = {
  id: string;
  requestType: RequestType;
  title: string;
  /** "Lekki → Yaba · Sat 6 Dec", or the place and date for work in one place. */
  summary: string;
  closesAt: string;
  quotes: number;
  /** Which bundled photo shows what was asked for. */
  photo: PhotoKey;
};

/** Bundled service photos (assets/images/logistics, cars); security uses its shield block. */
export type PhotoKey =
  | 'truck'
  | 'van'
  | 'moving'
  | 'courier'
  | 'delivery'
  | 'motorcycle'
  | 'sedan'
  | 'suv'
  | 'bus'
  | 'withDriver'
  | 'security';

export type VendorToday = {
  jobs: TodayJob[];
  requests: OpenRequest[];
  wallet: { available: number; held: number; heldJobs: number };
  /** Earnings so far this month and over the same days last month, day by day (cumulative). */
  month: { now: number[]; then: number[]; daysInMonth: number };
};

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** The day in a line or two: "2 jobs today," / "3 requests to quote". */
export function todayHeadline(jobs: number, requests: number): string[] {
  const j = jobs === 0 ? 'No jobs today' : `${plural(jobs, 'job', 'jobs')} today`;
  if (requests === 0) return [j];
  return [`${j},`, `${plural(requests, 'request', 'requests')} to quote`];
}

function span(ms: number): string {
  if (ms < HOUR) return `${String(Math.max(1, Math.floor(ms / MIN)))} min`;
  if (ms < DAY) return `${String(Math.floor(ms / HOUR))} h`;
  return plural(Math.floor(ms / DAY), 'day', 'days');
}

/** "5 h left" until a request stops taking quotes; "Closed" once it has. */
export function timeLeft(closesAt: string, nowMs: number): string {
  const t = Date.parse(closesAt);
  if (!Number.isFinite(t)) return '';
  const left = t - nowMs;
  return left <= 0 ? 'Closed' : `${span(left)} left`;
}

/** The summary row's detail: when the soonest still-open request closes. */
export function firstClosesLine(closesAt: readonly string[], nowMs: number): string {
  let soonest: number | null = null;
  for (const c of closesAt) {
    const t = Date.parse(c);
    if (Number.isFinite(t) && t > nowMs && (soonest === null || t < soonest)) soonest = t;
  }
  return soonest === null ? '' : `First one closes in ${span(soonest - nowMs)}`;
}

function clock(ms: number): string {
  const d = new Date(ms + LAGOS_OFFSET_MS);
  return `${String(d.getUTCHours())}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** The job card's pill: "9:00 · in 40 min", or "8:00 · now" once its time has come. */
export function startsLabel(startsAt: string, nowMs: number): string {
  const t = Date.parse(startsAt);
  if (!Number.isFinite(t)) return '';
  const wait = t - nowMs;
  if (wait <= 0) return `${clock(t)} · now`;
  const h = Math.floor(wait / HOUR);
  const m = Math.floor((wait % HOUR) / MIN);
  const words =
    h === 0
      ? `${String(Math.max(1, m))} min`
      : m === 0
        ? `${String(h)} h`
        : `${String(h)} h ${String(m)} min`;
  return `${clock(t)} · in ${words}`;
}

/** The job to show first (one already running, else the earliest), and the rest of today. */
export function upNext(jobs: readonly TodayJob[]): { next: TodayJob | null; later: TodayJob[] } {
  const open = jobs
    .filter((j) => j.stage !== 'done')
    .sort((a, b) => {
      if (a.stage !== b.stage) return a.stage === 'inProgress' ? -1 : 1;
      return Date.parse(a.startsAt) - Date.parse(b.startsAt);
    });
  return { next: open[0] ?? null, later: open.slice(1) };
}

/** This month against the same days last month; null when last month had nothing to compare. */
export function monthCompare(now: number, then: number): { change: number; up: boolean } | null {
  if (then <= 0) return null;
  const diff = now - then;
  return { change: Math.round((Math.abs(diff) / then) * 100), up: diff >= 0 };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1–29 Nov" against "1–29 Oct": the days compared, from a Lagos `YYYY-MM-DD`. */
export function monthLabels(today: string): { thisMonth: string; lastMonth: string } {
  const [y = 0, m = 1, d = 1] = today.split('-').map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const prevDays = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const span = (days: number, month: number) =>
    days === 1 ? `1 ${MONTHS[month - 1] ?? ''}` : `1–${String(days)} ${MONTHS[month - 1] ?? ''}`;
  return { thisMonth: span(d, m), lastMonth: span(Math.min(d, prevDays), prevMonth) };
}

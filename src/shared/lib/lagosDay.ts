// Hotels have no timezone column; the check-in RPC uses Africa/Lagos (WAT, UTC+1, no DST).
const LAGOS_OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

function parts(d: IsoDate): [number, number, number] {
  const m = ISO_RE.exec(d);
  if (m === null) throw new RangeError(`Not a YYYY-MM-DD date: ${d}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function utcMs(d: IsoDate): number {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day);
}

export function isIsoDate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  return new Date(utcMs(s)).toISOString().slice(0, 10) === s;
}

export function lagosToday(nowMs: number): IsoDate {
  return new Date(nowMs + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

export function shortDate(d: IsoDate): string {
  const [, m, day] = parts(d);
  return `${WEEKDAYS[new Date(utcMs(d)).getUTCDay()] ?? ''} ${String(day)} ${MONTHS[m - 1] ?? ''}`;
}

export function longDate(d: IsoDate): string {
  const [, m, day] = parts(d);
  return `${WEEKDAYS_LONG[new Date(utcMs(d)).getUTCDay()] ?? ''} ${String(day)} ${MONTHS_LONG[m - 1] ?? ''}`;
}

export function stayRange(from: IsoDate, to: IsoDate): string {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  if (fy === ty && fm === tm) return `${String(fd)}–${String(td)} ${MONTHS[tm - 1] ?? ''}`;
  return `${String(fd)} ${MONTHS[fm - 1] ?? ''} – ${String(td)} ${MONTHS[tm - 1] ?? ''}`;
}

export function lagosTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + LAGOS_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "at 10:42" for an instant on `today` (Lagos), else "on Sat 10 Oct at 10:42"; '' if unreadable. */
export function lagosWhen(iso: string, today: IsoDate): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const day = lagosToday(ms);
  const time = lagosTime(iso);
  return day === today ? `at ${time}` : `on ${shortDate(day)} at ${time}`;
}

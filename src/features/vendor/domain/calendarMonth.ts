import { MONTHS_LONG, type IsoDate } from '@/shared/lib/lagosDay';

/** One month as a Monday-first grid: null for the blanks around it. */
export function monthGrid(anyDay: IsoDate): { title: string; cells: (IsoDate | null)[] } {
  const [y = 0, m = 1] = anyDay.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (IsoDate | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++)
    cells.push(`${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return { title: `${MONTHS_LONG[m - 1] ?? ''} ${String(y)}`, cells };
}

/** The first day of the month `n` months after the one `anyDay` falls in. */
export function addMonths(anyDay: IsoDate, n: number): IsoDate {
  const [y = 0, m = 1] = anyDay.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

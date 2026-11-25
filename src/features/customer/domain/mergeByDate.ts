import type { IsoDate } from '@/shared/lib/lagosDay';

export type Dated<T> = { date: IsoDate; item: T };

/**
 * Two lists, each already in `order`, merged into one by date (Bookings: stays and events with car
 * requests). Stable: on the same day, the first list's items come first.
 */
export function mergeByDate<A, B>(
  a: readonly Dated<A>[],
  b: readonly Dated<B>[],
  order: 'asc' | 'desc',
): ({ from: 'a'; item: A } | { from: 'b'; item: B })[] {
  const out: ({ from: 'a'; item: A } | { from: 'b'; item: B })[] = [];
  let i = 0;
  let j = 0;
  const bFirst = (x: IsoDate, y: IsoDate) => (order === 'asc' ? y < x : y > x);
  while (i < a.length || j < b.length) {
    const x = a[i];
    const y = b[j];
    if (y !== undefined && (x === undefined || bFirst(x.date, y.date))) {
      out.push({ from: 'b', item: y.item });
      j += 1;
    } else if (x !== undefined) {
      out.push({ from: 'a', item: x.item });
      i += 1;
    }
  }
  return out;
}

/** Sorted copy by date (stable). */
export function sortByDate<T>(xs: readonly Dated<T>[], order: 'asc' | 'desc'): Dated<T>[] {
  return [...xs].sort((p, q) =>
    p.date === q.date ? 0 : p.date < q.date === (order === 'asc') ? -1 : 1,
  );
}

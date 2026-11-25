import { mergeByDate, sortByDate } from '@/features/customer/domain/mergeByDate';

const d = (date: string, item: string) => ({ date, item });

describe('mergeByDate', () => {
  it('interleaves two lists by date, soonest first', () => {
    const stays = [d('2026-12-02', 'hotel'), d('2026-12-10', 'event')];
    const cars = [d('2026-12-05', 'car')];
    expect(mergeByDate(stays, cars, 'asc').map((x) => x.item)).toEqual(['hotel', 'car', 'event']);
  });

  it('latest first for the past, first list first on the same day', () => {
    const stays = [d('2026-11-20', 'hotel'), d('2026-11-01', 'event')];
    const cars = [d('2026-11-20', 'car'), d('2026-10-01', 'old car')];
    expect(mergeByDate(stays, cars, 'desc').map((x) => x.item)).toEqual([
      'hotel',
      'car',
      'event',
      'old car',
    ]);
  });

  it('handles either list empty', () => {
    expect(mergeByDate([], [d('2026-12-05', 'car')], 'asc').map((x) => x.from)).toEqual(['b']);
    expect(mergeByDate([d('2026-12-05', 'x')], [], 'asc').map((x) => x.from)).toEqual(['a']);
  });
});

describe('sortByDate', () => {
  it('sorts stably in either order', () => {
    const xs = [d('2026-12-05', 'b'), d('2026-12-01', 'a'), d('2026-12-05', 'c')];
    expect(sortByDate(xs, 'asc').map((x) => x.item)).toEqual(['a', 'b', 'c']);
    expect(sortByDate(xs, 'desc').map((x) => x.item)).toEqual(['b', 'c', 'a']);
  });
});

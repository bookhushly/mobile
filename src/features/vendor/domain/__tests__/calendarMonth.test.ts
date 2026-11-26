import { monthGrid } from '@/features/vendor/domain/calendarMonth';

describe('monthGrid', () => {
  it('weeks start on Monday, with blanks before the first day', () => {
    const g = monthGrid('2026-12-01');
    expect(g.title).toBe('December 2026');
    // 1 Dec 2026 is a Tuesday: one blank first.
    expect(g.cells.slice(0, 3)).toEqual([null, '2026-12-01', '2026-12-02']);
    expect(g.cells.filter((c) => c !== null)).toHaveLength(31);
    expect(g.cells.length % 7).toBe(0);
  });
});

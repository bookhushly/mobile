import {
  blockedNights,
  bookedNights,
  planToggle,
  routeMonth,
} from '@/features/vendor/domain/calendarBlocks';

describe('routeMonth', () => {
  it('asks for the month itself, which the route pads by a month each side', () => {
    expect(routeMonth('2026-12-01')).toEqual({ year: 2026, month: 12 });
    expect(routeMonth('2027-06-01')).toEqual({ year: 2027, month: 6 });
  });
  it('asks for February when it wants January (the route pads January with the wrong December)', () => {
    // month=1 makes the route start at {year}-12-01, after its own end: nothing comes back.
    expect(routeMonth('2027-01-01')).toEqual({ year: 2027, month: 2 });
  });
});

describe('blockedNights', () => {
  it('counts both the first and last day of a block, inside the month only', () => {
    const blocks = [
      { id: 'a', start: '2026-11-29', end: '2026-12-02' },
      { id: 'b', start: '2026-12-10', end: '2026-12-10' },
      { id: 'c', start: '2026-12-31', end: '2027-01-04' },
    ];
    expect(blockedNights(blocks, '2026-12-01')).toEqual([
      '2026-12-01',
      '2026-12-02',
      '2026-12-10',
      '2026-12-31',
    ]);
  });
  it('lists a night once when two blocks overlap', () => {
    const blocks = [
      { id: 'a', start: '2026-12-01', end: '2026-12-03' },
      { id: 'b', start: '2026-12-03', end: '2026-12-04' },
    ];
    expect(blockedNights(blocks, '2026-12-01')).toEqual([
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
    ]);
  });
});

describe('bookedNights', () => {
  it('is every night from check-in up to (not including) check-out', () => {
    const stays = [
      { checkIn: '2026-12-05', checkOut: '2026-12-08' },
      { checkIn: '2026-11-30', checkOut: '2026-12-02' },
    ];
    expect(bookedNights(stays, '2026-12-01')).toEqual([
      '2026-12-01',
      '2026-12-05',
      '2026-12-06',
      '2026-12-07',
    ]);
  });
});

describe('planToggle', () => {
  it('blocks a free night as a one-day block', () => {
    expect(planToggle([], '2026-12-14')).toEqual({
      kind: 'block',
      start: '2026-12-14',
      end: '2026-12-14',
    });
  });
  it('removes a one-day block whole', () => {
    expect(planToggle([{ id: 'a', start: '2026-12-14', end: '2026-12-14' }], '2026-12-14')).toEqual(
      { kind: 'unblock', create: [], remove: ['a'] },
    );
  });
  it('keeps the rest of a longer block: the pieces either side are recreated', () => {
    expect(planToggle([{ id: 'a', start: '2026-12-10', end: '2026-12-15' }], '2026-12-12')).toEqual(
      {
        kind: 'unblock',
        create: [
          { start: '2026-12-10', end: '2026-12-11' },
          { start: '2026-12-13', end: '2026-12-15' },
        ],
        remove: ['a'],
      },
    );
  });
  it('trims a block at its first or last night', () => {
    const blocks = [{ id: 'a', start: '2026-12-10', end: '2026-12-12' }];
    expect(planToggle(blocks, '2026-12-10')).toMatchObject({
      create: [{ start: '2026-12-11', end: '2026-12-12' }],
    });
    expect(planToggle(blocks, '2026-12-12')).toMatchObject({
      create: [{ start: '2026-12-10', end: '2026-12-11' }],
    });
  });
  it('opens the night in every block that holds it', () => {
    const plan = planToggle(
      [
        { id: 'a', start: '2026-12-10', end: '2026-12-10' },
        { id: 'b', start: '2026-12-09', end: '2026-12-11' },
        { id: 'c', start: '2026-12-20', end: '2026-12-21' },
      ],
      '2026-12-10',
    );
    expect(plan).toEqual({
      kind: 'unblock',
      create: [
        { start: '2026-12-09', end: '2026-12-09' },
        { start: '2026-12-11', end: '2026-12-11' },
      ],
      remove: ['a', 'b'],
    });
  });
  it('a retry after a half-finished open doesn’t recreate pieces that already exist', () => {
    // 10–15 was being split around the 12th: 10–11 got created, then the connection dropped.
    const plan = planToggle(
      [
        { id: 'old', start: '2026-12-10', end: '2026-12-15' },
        { id: 'p1', start: '2026-12-10', end: '2026-12-11' },
      ],
      '2026-12-12',
    );
    expect(plan).toEqual({
      kind: 'unblock',
      create: [{ start: '2026-12-13', end: '2026-12-15' }],
      remove: ['old'],
    });
  });
});

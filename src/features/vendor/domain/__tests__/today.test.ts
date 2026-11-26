import {
  firstClosesLine,
  monthCompare,
  monthLabels,
  startsLabel,
  timeLeft,
  todayHeadline,
  upNext,
  type TodayJob,
} from '@/features/vendor/domain/today';

// 2026-11-29 08:20 in Lagos (UTC+1).
const NOW = Date.parse('2026-11-29T07:20:00Z');
const at = (iso: string) => iso;

describe('todayHeadline', () => {
  it('jobs and requests', () => {
    expect(todayHeadline(2, 3)).toEqual(['2 jobs today,', '3 requests to quote']);
  });
  it('singular words', () => {
    expect(todayHeadline(1, 1)).toEqual(['1 job today,', '1 request to quote']);
  });
  it('only jobs', () => {
    expect(todayHeadline(2, 0)).toEqual(['2 jobs today']);
  });
  it('only requests', () => {
    expect(todayHeadline(0, 3)).toEqual(['No jobs today,', '3 requests to quote']);
  });
  it('a quiet day says so, never a zero count', () => {
    expect(todayHeadline(0, 0)).toEqual(['No jobs today']);
  });
});

describe('timeLeft', () => {
  it.each([
    ['2026-11-29T07:50:00Z', '30 min left'],
    ['2026-11-29T12:20:00Z', '5 h left'],
    ['2026-11-30T05:20:00Z', '22 h left'],
    ['2026-12-01T07:20:00Z', '2 days left'],
    ['2026-11-29T07:00:00Z', 'Closed'],
  ])('closing at %s -> %s', (closes, label) => {
    expect(timeLeft(at(closes), NOW)).toBe(label);
  });
  it('an unreadable time says nothing rather than something wrong', () => {
    expect(timeLeft('not a date', NOW)).toBe('');
  });
});

describe('firstClosesLine', () => {
  it('names the soonest open request', () => {
    expect(firstClosesLine(['2026-11-30T05:20:00Z', '2026-11-29T12:20:00Z'], NOW)).toBe(
      'First one closes in 5 h',
    );
  });
  it('ignores requests already closed, and says nothing when none are left', () => {
    expect(firstClosesLine(['2026-11-29T07:00:00Z'], NOW)).toBe('');
    expect(firstClosesLine([], NOW)).toBe('');
  });
});

describe('startsLabel', () => {
  it('a job later today counts down', () => {
    expect(startsLabel('2026-11-29T08:00:00Z', NOW)).toBe('9:00 · in 40 min');
    expect(startsLabel('2026-11-29T13:00:00Z', NOW)).toBe('14:00 · in 5 h 40 min');
  });
  it('a job that has started says now', () => {
    expect(startsLabel('2026-11-29T07:00:00Z', NOW)).toBe('8:00 · now');
  });
});

describe('upNext', () => {
  const job = (id: string, startsAt: string, stage: TodayJob['stage']): TodayJob => ({
    id,
    requestType: 'logistics',
    title: id,
    startsAt,
    from: 'A',
    to: 'B',
    customerName: 'Ada O.',
    payout: 1,
    stage,
    photo: 'truck',
  });
  it('the earliest job still to finish leads; the rest are later today', () => {
    const r = upNext([
      job('late', '2026-11-29T13:00:00Z', 'paid'),
      job('early', '2026-11-29T08:00:00Z', 'paid'),
      job('done', '2026-11-29T06:00:00Z', 'done'),
    ]);
    expect(r.next?.id).toBe('early');
    expect(r.later.map((j) => j.id)).toEqual(['late']);
  });
  it('a job already running comes first, whatever its time', () => {
    const r = upNext([
      job('early', '2026-11-29T08:00:00Z', 'paid'),
      job('running', '2026-11-29T09:00:00Z', 'inProgress'),
    ]);
    expect(r.next?.id).toBe('running');
  });
  it('nothing to do', () => {
    expect(upNext([])).toEqual({ next: null, later: [] });
  });
});

describe('monthCompare', () => {
  it('this month against the same days last month, as a rounded percentage', () => {
    expect(monthCompare(412_500, 348_500)).toEqual({ change: 18, up: true });
    expect(monthCompare(300_000, 400_000)).toEqual({ change: 25, up: false });
  });
  it('no change', () => {
    expect(monthCompare(100, 100)).toEqual({ change: 0, up: true });
  });
  it('nothing last month to compare with', () => {
    expect(monthCompare(50_000, 0)).toBeNull();
  });
});

describe('monthLabels', () => {
  it('the same span of days in both months', () => {
    expect(monthLabels('2026-11-29')).toEqual({ thisMonth: '1–29 Nov', lastMonth: '1–29 Oct' });
  });
  it('the first of the month is one day', () => {
    expect(monthLabels('2026-12-01')).toEqual({ thisMonth: '1 Dec', lastMonth: '1 Nov' });
  });
  it('a shorter last month stops at its last day; January looks back to December', () => {
    expect(monthLabels('2026-03-31')).toEqual({ thisMonth: '1–31 Mar', lastMonth: '1–28 Feb' });
    expect(monthLabels('2027-01-10')).toEqual({ thisMonth: '1–10 Jan', lastMonth: '1–10 Dec' });
  });
});

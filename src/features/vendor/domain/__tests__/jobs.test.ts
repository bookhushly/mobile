import {
  groupByDay,
  heldLine,
  jobHeadline,
  jobProgress,
  jobStage,
  nextStep,
  splitJobs,
  type VendorJob,
} from '@/features/vendor/domain/jobs';

const NOW = Date.parse('2026-11-29T07:20:00Z');

const job = (over: Partial<VendorJob> = {}): VendorJob => ({
  id: 'j1',
  requestType: 'logistics',
  title: 'Move a 2-bed flat',
  startsAt: '2026-11-29T08:00:00Z',
  from: 'Admiralty Way, Lekki Phase 1',
  to: 'Herbert Macaulay Way, Yaba',
  toShort: 'Yaba',
  customer: { name: 'Ada Okafor', phone: '+2348012345678' },
  paid: 85_000,
  payout: 76_500,
  status: 'paid',
  vendorCompletedAt: null,
  milestones: { pickedUpAt: null, inTransitAt: null, deliveredAt: null },
  photo: 'moving',
  ...over,
});

describe('jobStage', () => {
  it.each([
    [{ status: 'matched' }, 'awaitingPayment'],
    [{ status: 'paid' }, 'ready'],
    [{ status: 'in_progress' }, 'running'],
    [{ status: 'in_progress', vendorCompletedAt: '2026-11-29T09:00:00Z' }, 'awaitingConfirm'],
    [{ status: 'completed' }, 'done'],
    [{ status: 'disputed' }, 'disputed'],
  ] as const)('%o -> %s', (over, stage) => {
    expect(jobStage(job(over))).toBe(stage);
  });
});

describe('nextStep', () => {
  it('a paid job starts', () => {
    expect(nextStep(job())).toEqual({ kind: 'start' });
  });
  it('a waiting-for-payment job has nothing to do yet', () => {
    expect(nextStep(job({ status: 'matched' }))).toBeNull();
  });
  it('logistics goes picked up -> on the way -> delivered (with a photo)', () => {
    const running = job({ status: 'in_progress' });
    expect(nextStep(running)).toEqual({ kind: 'milestone', milestone: 'picked_up' });
    expect(
      nextStep({ ...running, milestones: { ...running.milestones, pickedUpAt: 'x' } }),
    ).toEqual({ kind: 'milestone', milestone: 'in_transit' });
    expect(
      nextStep({
        ...running,
        milestones: { pickedUpAt: 'x', inTransitAt: 'y', deliveredAt: null },
      }),
    ).toEqual({ kind: 'milestone', milestone: 'delivered' });
  });
  it('delivered recorded but not completed (a 503 on the server): Mark done, never delivered again', () => {
    expect(
      nextStep(
        job({
          status: 'in_progress',
          milestones: { pickedUpAt: 'x', inTransitAt: 'y', deliveredAt: 'z' },
        }),
      ),
    ).toEqual({ kind: 'complete' });
  });
  it('car rental and security are marked done in one step', () => {
    expect(nextStep(job({ requestType: 'security', status: 'in_progress' }))).toEqual({
      kind: 'complete',
    });
  });
  it('nothing once marked done, confirmed or in dispute', () => {
    expect(nextStep(job({ status: 'in_progress', vendorCompletedAt: 'x' }))).toBeNull();
    expect(nextStep(job({ status: 'completed' }))).toBeNull();
    expect(nextStep(job({ status: 'disputed' }))).toBeNull();
  });
});

describe('jobProgress', () => {
  it('logistics: four steps, filled as they happen', () => {
    expect(
      jobProgress(
        job({
          status: 'in_progress',
          milestones: { pickedUpAt: 'x', inTransitAt: 'y', deliveredAt: null },
        }),
      ),
    ).toEqual([
      { label: 'Paid', done: true },
      { label: 'Picked up', done: true },
      { label: 'On the way', done: true },
      { label: 'Delivered', done: false },
    ]);
  });
  it('others: paid, started, done', () => {
    expect(jobProgress(job({ requestType: 'security', status: 'in_progress' }))).toEqual([
      { label: 'Paid', done: true },
      { label: 'Started', done: true },
      { label: 'Done', done: false },
    ]);
  });
  it('waiting for payment: nothing filled', () => {
    expect(jobProgress(job({ status: 'matched' })).every((s) => !s.done)).toBe(true);
  });
});

describe('jobHeadline', () => {
  it('says where the job stands', () => {
    expect(jobHeadline(job({ status: 'matched' }))).toBe('Waiting for payment');
    expect(jobHeadline(job())).toBe('Ready to start');
    expect(jobHeadline(job({ status: 'in_progress' }))).toBe('Go to the pick-up');
    expect(
      jobHeadline(
        job({
          status: 'in_progress',
          milestones: { pickedUpAt: 'x', inTransitAt: null, deliveredAt: null },
        }),
      ),
    ).toBe('Picked up');
    expect(
      jobHeadline(
        job({
          status: 'in_progress',
          milestones: { pickedUpAt: 'x', inTransitAt: 'y', deliveredAt: null },
        }),
      ),
    ).toBe('On the way to Yaba');
    expect(jobHeadline(job({ requestType: 'security', status: 'in_progress' }))).toBe('On the job');
    expect(jobHeadline(job({ status: 'in_progress', vendorCompletedAt: 'x' }))).toBe(
      'Waiting for Ada to confirm',
    );
    expect(jobHeadline(job({ status: 'completed' }))).toBe('Done and paid');
    expect(jobHeadline(job({ status: 'disputed' }))).toBe('On hold');
  });
});

describe('heldLine', () => {
  it('where the money is', () => {
    expect(heldLine(job({ status: 'matched' }))).toBeNull();
    expect(heldLine(job())).toBe(
      '₦76,500 is held for you. It’s released when Ada confirms the job’s done.',
    );
    expect(heldLine(job({ status: 'completed' }))).toBe('₦76,500 was added to your wallet.');
    expect(heldLine(job({ status: 'disputed' }))).toBe(
      '₦76,500 stays held while Bookhushly looks into Ada’s report.',
    );
  });
});

describe('splitJobs and groupByDay', () => {
  it('upcoming: not started; running: started or waiting to confirm, or in dispute; done', () => {
    const r = splitJobs([
      job({ id: 'a', status: 'matched' }),
      job({ id: 'b' }),
      job({ id: 'c', status: 'in_progress' }),
      job({ id: 'd', status: 'in_progress', vendorCompletedAt: 'x' }),
      job({ id: 'e', status: 'disputed' }),
      job({ id: 'f', status: 'completed' }),
    ]);
    expect(r.upcoming.map((j) => j.id)).toEqual(['a', 'b']);
    expect(r.running.map((j) => j.id)).toEqual(['c', 'd', 'e']);
    expect(r.done.map((j) => j.id)).toEqual(['f']);
  });

  it('groups by Lagos day: Today, Tomorrow, then the date', () => {
    const groups = groupByDay(
      [
        job({ id: 'later', startsAt: '2026-12-03T07:00:00Z' }),
        job({ id: 'today', startsAt: '2026-11-29T08:00:00Z' }),
        job({ id: 'tomorrow', startsAt: '2026-11-30T09:00:00Z' }),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.jobs.map((j) => j.id)])).toEqual([
      ['Today', ['today']],
      ['Tomorrow', ['tomorrow']],
      ['Thu 3 Dec', ['later']],
    ]);
  });
});

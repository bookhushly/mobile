import {
  createMarkSet,
  MARKS_MAX,
  refundMarks,
  reviewedMarks,
} from '@/features/customer/offline/actionMarks';
import { memoryKv } from '@/shared/lib/kv';
import { runAlwaysWipes } from '@/shared/lib/signOutGuard';

jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));
const mockKv = jest.requireMock<{ plainKv: ReturnType<typeof memoryKv> }>(
  '@/shared/platform/storage',
).plainKv;

const yes = () => Promise.resolve(true);
const no = () => Promise.resolve(false);

describe('mark sets', () => {
  it('keys per user and keeps each id once', async () => {
    const kv = memoryKv();
    const s = createMarkSet(kv, 'bh.test.', 'bh.test-users');
    await s.add('u1', 'a', yes);
    await s.add('u1', 'b', yes);
    await s.add('u1', 'a', yes);
    expect(await s.get('u1')).toEqual(['b', 'a']);
    expect(await s.get('u2')).toEqual([]);
    expect(Object.keys(kv.dump()).sort()).toEqual(['bh.test-users', 'bh.test.u1']);
  });

  it('writes nothing once the account is no longer signed in (or the check throws)', async () => {
    const kv = memoryKv();
    const s = createMarkSet(kv, 'bh.test.', 'bh.test-users');
    await s.add('u1', 'a', no);
    await s.add('u1', 'b', () => Promise.reject(new Error('x')));
    expect(kv.dump()).toEqual({});
  });

  it('a clear queued after an add is never overtaken by it', async () => {
    const kv = memoryKv();
    const s = createMarkSet(kv, 'bh.test.', 'bh.test-users');
    const add = s.add('u1', 'a', yes);
    const clear = s.clear();
    await Promise.all([add, clear]);
    expect(kv.dump()).toEqual({});
  });

  it(`keeps the newest ${String(MARKS_MAX)}`, async () => {
    const s = createMarkSet(memoryKv(), 'bh.test.', 'bh.test-users');
    for (let i = 0; i < MARKS_MAX + 5; i += 1) await s.add('u1', `id${String(i)}`, yes);
    const got = await s.get('u1');
    expect(got).toHaveLength(MARKS_MAX);
    expect(got[0]).toBe('id5');
  });

  it('a corrupt value reads as empty', async () => {
    const kv = memoryKv();
    await kv.set('bh.test.u1', '{nope');
    expect(await createMarkSet(kv, 'bh.test.', 'bh.test-users').get('u1')).toEqual([]);
  });
});

it('the reviewed and refund-requested sets use their keys and go on every sign-out', async () => {
  await reviewedMarks.add('u1', 'listing-1', yes);
  await refundMarks.add('u2', 'booking-1', yes);
  expect(mockKv.dump()).toMatchObject({
    'bh.reviewed.u1': '["listing-1"]',
    'bh.refund-req.u2': '["booking-1"]',
  });
  await runAlwaysWipes();
  expect(mockKv.dump()).toEqual({});
});

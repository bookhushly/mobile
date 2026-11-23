import {
  createCarPayStore,
  CAR_PAY_KEY,
  CAR_PAY_MAX,
  CAR_PAY_TTL_MS,
} from '@/features/customer/offline/carPayStore';
import { memoryKv } from '@/shared/lib/kv';

jest.mock('@/shared/platform/storage', () => ({ plainKv: {} }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => 0 } }));
jest.mock('@/shared/lib/signOutGuard', () => ({ registerAlwaysWipe: jest.fn() }));

const e = (startedAt: number) => ({
  reference: `ref-${String(startedAt)}`,
  url: 'https://checkout.paystack.com/x',
  startedAt,
});

describe('carPayStore', () => {
  it('keeps a reference per user and request, and drops it', async () => {
    const kv = memoryKv();
    const s = createCarPayStore(kv, () => 1000);
    await s.put('u1', 'r1', e(1000));
    expect(await s.get('u1', 'r1')).toEqual(e(1000));
    expect(await s.get('u2', 'r1')).toBeNull();
    await s.drop('u1', 'r1');
    expect(await s.get('u1', 'r1')).toBeNull();
  });

  it('forgets entries after a day, and keeps only the newest few', async () => {
    let t = 0;
    const kv = memoryKv();
    const s = createCarPayStore(kv, () => t);
    for (let i = 0; i < CAR_PAY_MAX + 5; i += 1) await s.put('u1', `r${String(i)}`, e(i));
    const kept: unknown = JSON.parse(kv.dump()[CAR_PAY_KEY] ?? '{}');
    expect(Object.keys(kept as object)).toHaveLength(CAR_PAY_MAX);
    expect(await s.get('u1', 'r0')).toBeNull();
    t = CAR_PAY_TTL_MS + 30;
    expect(await s.get('u1', `r${String(CAR_PAY_MAX + 4)}`)).toBeNull();
  });

  it('reads damaged storage as empty, and wipes on sign-out', async () => {
    const kv = memoryKv();
    await kv.set(CAR_PAY_KEY, '{not json');
    const s = createCarPayStore(kv, () => 0);
    expect(await s.get('u1', 'r1')).toBeNull();
    await s.put('u1', 'r1', e(0));
    await s.wipe();
    expect(kv.dump()[CAR_PAY_KEY]).toBeUndefined();
  });

  it('a failed write throws, so no checkout opens without its reference saved', async () => {
    const kv = { ...memoryKv(), set: () => Promise.reject(new Error('disk full')) };
    const s = createCarPayStore(kv, () => 0);
    await expect(s.put('u1', 'r1', e(0))).rejects.toThrow('disk full');
  });

  it('keeps the checkout link only for the reopen window, the reference for a day', async () => {
    let t = 0;
    const s = createCarPayStore(memoryKv(), () => t);
    await s.put('u1', 'r1', e(0));
    t = 31 * 60_000;
    expect(await s.get('u1', 'r1')).toEqual({ ...e(0), url: '' });
  });
});

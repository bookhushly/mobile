import { createRecovery, RECOVERY_KEY } from '@/features/auth/domain/recovery';
import { memoryKv } from '@/shared/lib/kv';

it('begin marks, finish clears, pending reads', async () => {
  const kv = memoryKv();
  const r = createRecovery(kv);
  expect(await r.pending()).toBe(false);
  await r.begin();
  expect(Object.keys(kv.dump())).toContain(RECOVERY_KEY);
  expect(await r.pending()).toBe(true);
  await r.finish();
  expect(await r.pending()).toBe(false);
  expect(Object.keys(kv.dump())).not.toContain(RECOVERY_KEY);
});

it('an unreadable marker counts as pending (fail safe: sign out)', async () => {
  const r = createRecovery({
    get: () => Promise.reject(new Error('x')),
    set: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  });
  expect(await r.pending()).toBe(true);
});

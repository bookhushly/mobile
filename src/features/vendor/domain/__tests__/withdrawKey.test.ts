import { createWithdrawKeys } from '@/features/vendor/domain/withdrawKey';
import { memoryKv } from '@/shared/lib/kv';

describe('withdraw keys', () => {
  it('the same amount reuses the saved key, even from a new screen; a new amount gets a new one', async () => {
    let n = 0;
    const kv = memoryKv();
    const mint = () => `key-${String(++n)}`;
    expect(await createWithdrawKeys(kv, mint).forAmount('v1', 20_000)).toBe('key-1');
    // A new instance stands in for the screen (or the app) starting again.
    expect(await createWithdrawKeys(kv, mint).forAmount('v1', 20_000)).toBe('key-1');
    expect(await createWithdrawKeys(kv, mint).forAmount('v1', 15_000)).toBe('key-2');
  });

  it('cleared after a success: the next withdrawal is a new one', async () => {
    let n = 0;
    const keys = createWithdrawKeys(memoryKv(), () => `key-${String(++n)}`);
    await keys.forAmount('v1', 20_000);
    await keys.clear('v1');
    expect(await keys.forAmount('v1', 20_000)).toBe('key-2');
  });

  it('kept per vendor', async () => {
    let n = 0;
    const keys = createWithdrawKeys(memoryKv(), () => `key-${String(++n)}`);
    expect(await keys.forAmount('a', 1_000)).toBe('key-1');
    expect(await keys.forAmount('b', 1_000)).toBe('key-2');
  });
});

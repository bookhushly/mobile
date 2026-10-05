import { memoryKv } from '@/shared/lib/kv';
import { createEncryptedStore } from '@/shared/supabase/encryptedStore';

const randomBytes = (() => {
  let n = 1;
  return (len: number) => Uint8Array.from({ length: len }, () => n++ % 251);
})();

function make(
  over: { secure?: ReturnType<typeof memoryKv>; plain?: ReturnType<typeof memoryKv> } = {},
) {
  const secure = over.secure ?? memoryKv();
  const plain = over.plain ?? memoryKv();
  const store = createEncryptedStore({ secure, plain, randomBytes, storageKey: 'bh-auth' });
  return { store, secure, plain };
}

describe('encrypted store', () => {
  it('round-trips a session larger than 2 KB', async () => {
    const { store } = make();
    const big = JSON.stringify({ access_token: 'a'.repeat(3000), user: { id: 'u' } });
    await store.setItem('bh-auth', big);
    expect(await store.getItem('bh-auth')).toBe(big);
  });

  it('keeps ciphertext (not plaintext) in the plain store and only the key in the secure store', async () => {
    const { store, secure, plain } = make();
    await store.setItem('bh-auth', 'super-secret-session');
    expect(Object.values(plain.dump()).join('')).not.toContain('super-secret-session');
    expect(Object.keys(secure.dump())).toContain('bh-auth.k');
    expect(Object.values(secure.dump()).join('')).not.toContain('super-secret-session');
  });

  it('returns null when nothing is stored, and removeItem clears both halves', async () => {
    const { store, secure, plain } = make();
    expect(await store.getItem('bh-auth')).toBeNull();
    await store.setItem('bh-auth', 'x');
    await store.removeItem('bh-auth');
    expect(await store.getItem('bh-auth')).toBeNull();
    expect(secure.dump()['bh-auth.k']).toBeUndefined();
    expect(plain.dump()['bh-auth']).toBeUndefined();
  });

  it('returns null (does not throw) when the ciphertext is corrupt', async () => {
    const { store, plain } = make();
    await store.setItem('bh-auth', 'x');
    await plain.set('bh-auth', 'zz-not-hex');
    expect(await store.getItem('bh-auth')).toBeNull();
  });

  it('wipes a leftover Keychain key on a fresh install (no install marker)', async () => {
    const secure = memoryKv();
    await secure.set('bh-auth.k', 'aa'.repeat(32)); // iOS Keychain survived uninstall
    const plain = memoryKv(); // app data is gone
    const { store } = make({ secure, plain });
    expect(await store.getItem('bh-auth')).toBeNull();
    expect(secure.dump()['bh-auth.k']).toBeUndefined();
    expect(plain.dump()['bh.installed']).toBe('1');
  });

  it('does not wipe on a normal launch (marker present)', async () => {
    const first = make();
    await first.store.setItem('bh-auth', 'keep-me');
    const second = createEncryptedStore({
      secure: first.secure,
      plain: first.plain,
      randomBytes,
      storageKey: 'bh-auth',
    });
    expect(await second.getItem('bh-auth')).toBe('keep-me');
  });
});

describe('encrypted store robustness', () => {
  it('returns null (does not throw) when the secure store read throws', async () => {
    const secure = memoryKv();
    const plain = memoryKv();
    const { store } = make({ secure, plain });
    await store.setItem('bh-auth', 'x');
    const throwing = { ...secure, get: () => Promise.reject(new Error('keystore invalidated')) };
    const broken = createEncryptedStore({
      secure: throwing,
      plain,
      randomBytes,
      storageKey: 'bh-auth',
    });
    expect(await broken.getItem('bh-auth')).toBeNull();
  });
  it('keeps working for the session if the first-launch wipe throws', async () => {
    const secure = { ...memoryKv(), delete: () => Promise.reject(new Error('locked')) };
    const store = createEncryptedStore({
      secure,
      plain: memoryKv(),
      randomBytes,
      storageKey: 'bh-auth',
    });
    expect(await store.getItem('bh-auth')).toBeNull();
    await expect(store.setItem('bh-auth', 'v')).resolves.toBeUndefined();
  });
});

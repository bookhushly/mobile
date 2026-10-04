import aes from 'aes-js';

import type { KeyValue } from '@/shared/lib/kv';

type Deps = {
  secure: KeyValue;
  plain: KeyValue;
  randomBytes: (n: number) => Uint8Array;
  storageKey: string;
};

const MARKER = 'bh.installed';

export function createEncryptedStore(deps: Deps) {
  const keyName = (k: string) => `${k}.k`;

  // Fresh install: the iOS Keychain can outlive an uninstall while app data does not.
  // Never rejects: if the wipe fails (e.g. a locked Keychain) the marker stays unset and the wipe
  // is retried next launch, but the store keeps working for this session.
  const ready = (async () => {
    try {
      if ((await deps.plain.get(MARKER)) === null) {
        await deps.secure.delete(keyName(deps.storageKey));
        await deps.plain.delete(deps.storageKey);
        await deps.plain.set(MARKER, '1');
      }
    } catch {
      // intentionally ignored; see above
    }
  })();

  async function getItem(k: string): Promise<string | null> {
    await ready;
    try {
      const [keyHex, cipherHex] = await Promise.all([
        deps.secure.get(keyName(k)),
        deps.plain.get(k),
      ]);
      if (keyHex === null || cipherHex === null) return null;
      if (!/^[0-9a-f]+$/i.test(keyHex) || !/^[0-9a-f]+$/i.test(cipherHex)) return null;
      const key = aes.utils.hex.toBytes(keyHex);
      if (key.length !== 32) return null;
      const ctr = new aes.ModeOfOperation.ctr(key, new aes.Counter(1));
      return aes.utils.utf8.fromBytes(ctr.decrypt(aes.utils.hex.toBytes(cipherHex)));
    } catch {
      return null;
    }
  }

  async function setItem(k: string, value: string): Promise<void> {
    await ready;
    const key = deps.randomBytes(32);
    const ctr = new aes.ModeOfOperation.ctr(key, new aes.Counter(1));
    const cipher = ctr.encrypt(aes.utils.utf8.toBytes(value));
    await deps.secure.set(keyName(k), aes.utils.hex.fromBytes(key));
    await deps.plain.set(k, aes.utils.hex.fromBytes(cipher));
  }

  async function removeItem(k: string): Promise<void> {
    await ready;
    await deps.secure.delete(keyName(k));
    await deps.plain.delete(k);
  }

  return { getItem, setItem, removeItem };
}

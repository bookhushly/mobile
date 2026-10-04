import * as SecureStore from 'expo-secure-store';

import type { KeyValue } from '@/shared/lib/kv';

export const secureKv: KeyValue = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) =>
    SecureStore.setItemAsync(k, v, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  delete: (k) => SecureStore.deleteItemAsync(k),
};

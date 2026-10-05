import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValue } from '@/shared/lib/kv';

export const plainKv: KeyValue = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  delete: (k) => AsyncStorage.removeItem(k),
};

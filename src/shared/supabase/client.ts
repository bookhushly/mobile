import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from '@/shared/config/env';
import { plainKv } from '@/shared/platform/storage';
import { secureKv } from '@/shared/platform/secureStore';

import { createEncryptedStore } from './encryptedStore';

export const STORAGE_KEY = 'bh-auth';

export const sessionStore = createEncryptedStore({
  secure: secureKv,
  plain: plainKv,
  randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  storageKey: STORAGE_KEY,
});

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: sessionStore,
    storageKey: STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (s) => {
  if (s === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});

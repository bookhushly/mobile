import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { env } from '@/shared/config/env';
import { createClock } from '@/shared/lib/clock';
import { plainKv } from '@/shared/platform/storage';
import { supabase } from '@/shared/supabase/client';

import { createApiClient } from './client';

export const clock = createClock({ storage: plainKv, now: () => Date.now() });
void clock.load();

const version = Application.nativeApplicationVersion ?? '0.0.0';
const build = Application.nativeBuildVersion ?? '0';

export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  fetchFn: (...a) => fetch(...a),
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  refreshSession: async () =>
    (await supabase.auth.refreshSession()).data.session?.access_token ?? null,
  clock,
  appVersion: `${version} (${build})`,
  platform: Platform.OS,
});

export const APP_VERSION = version;

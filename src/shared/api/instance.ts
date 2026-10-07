import * as Application from 'expo-application';
import { AppState, Platform } from 'react-native';

import { env } from '@/shared/config/env';
import { createClock } from '@/shared/lib/clock';
import { createClockGuard } from '@/shared/lib/clockGuard';
import { createConnectivity } from '@/shared/lib/connectivity';
import { plainKv } from '@/shared/platform/storage';
import { supabase } from '@/shared/supabase/client';

import { createApiClient } from './client';

export const clock = createClock({ storage: plainKv, now: () => Date.now() });
void clock.load();

export const connectivity = createConnectivity();

export const clockGuard = createClockGuard({
  wallNow: () => Date.now(),
  monoNow: () => performance.now(),
  serverNow: () => clock.serverNow(),
  lastContactMs: () => clock.lastContactMs(),
});

// App-lifetime listener: time asleep is not a clock change, wherever the user is when the phone wakes.
AppState.addEventListener('change', (s) => {
  if (s === 'active') clockGuard.rebase();
});

const version = Application.nativeApplicationVersion ?? '0.0.0';
const build = Application.nativeBuildVersion ?? '0';

export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  fetchFn: (...a) => fetch(...a),
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  refreshSession: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (data.session) return { token: data.session.access_token };
    const transient =
      error?.name === 'AuthRetryableFetchError' ||
      (error?.status ?? 0) >= 500 ||
      error?.status === 0;
    return { failure: transient ? ('network' as const) : ('invalid' as const) };
  },
  clock,
  appVersion: `${version} (${build})`,
  platform: Platform.OS,
  onReach: (reached) => {
    if (reached) connectivity.reached();
    else connectivity.unreachable();
  },
});

export const APP_VERSION = version;

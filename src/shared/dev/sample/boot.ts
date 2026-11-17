import { env } from '@/shared/config/env';

// Sample-data mode (docs/SAMPLE_DATA.md): start Metro with EXPO_PUBLIC_SAMPLE_DATA=1. Dev builds
// only: `__DEV__` is false in release builds, so this branch and the sample data are removed.
if (__DEV__ && process.env.EXPO_PUBLIC_SAMPLE_DATA === '1') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sample = require('./install') as typeof import('./install');
  sample.installSampleBackend(env.supabaseUrl, env.apiBaseUrl);
}

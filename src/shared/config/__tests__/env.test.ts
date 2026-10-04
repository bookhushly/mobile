import { parseEnv } from '@/shared/config/env';

const good = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-1234567890',
  EXPO_PUBLIC_API_BASE_URL: 'https://www.bookhushly.com',
};

it('parses valid env and strips trailing slash', () => {
  expect(
    parseEnv({ ...good, EXPO_PUBLIC_API_BASE_URL: 'https://www.bookhushly.com/' }).apiBaseUrl,
  ).toBe('https://www.bookhushly.com');
});
it('treats an empty sentry dsn as undefined', () => {
  expect(parseEnv({ ...good, EXPO_PUBLIC_SENTRY_DSN: '' }).sentryDsn).toBeUndefined();
});
it('throws a readable error listing the missing variable', () => {
  expect(() => parseEnv({ ...good, EXPO_PUBLIC_SUPABASE_URL: undefined })).toThrow(
    /EXPO_PUBLIC_SUPABASE_URL/,
  );
});

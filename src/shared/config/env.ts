import { z } from 'zod';

const schema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  EXPO_PUBLIC_API_BASE_URL: z.url(),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
  sentryDsn: string | undefined;
};

export function parseEnv(source: Record<string, string | undefined>): Env {
  const r = schema.safeParse(source);
  if (!r.success) {
    const names = r.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  const d = r.data;
  return {
    supabaseUrl: d.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: d.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiBaseUrl: d.EXPO_PUBLIC_API_BASE_URL.replace(/\/+$/, ''),
    sentryDsn: d.EXPO_PUBLIC_SENTRY_DSN ? d.EXPO_PUBLIC_SENTRY_DSN : undefined,
  };
}

// Static dot-access only: Expo inlines process.env.EXPO_PUBLIC_X at build time.
const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export const env: Env = parseEnv({
  EXPO_PUBLIC_SUPABASE_URL: asString(process.env.EXPO_PUBLIC_SUPABASE_URL),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: asString(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  EXPO_PUBLIC_API_BASE_URL: asString(process.env.EXPO_PUBLIC_API_BASE_URL),
  EXPO_PUBLIC_SENTRY_DSN: asString(process.env.EXPO_PUBLIC_SENTRY_DSN),
});

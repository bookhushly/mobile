process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-1234567890';
process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.test';

// @sentry/react-native starts a module-level setInterval on import, which keeps Jest workers
// alive ("worker process has failed to exit gracefully"). Tests never report to Sentry.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  wrap: <T>(component: T): T => component,
}));

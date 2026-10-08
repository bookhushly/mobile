process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-1234567890';
process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.test';

// react-native-worklets (Reanimated 4) needs its native module; the documented Jest setup is the
// bundled mock (https://docs.swmansion.com/react-native-worklets/docs/guides/testing/).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// Reanimated 4 Jest setup (https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/).
require('react-native-reanimated').setUpTests();

// @sentry/react-native starts a module-level setInterval on import, which keeps Jest workers
// alive ("worker process has failed to exit gracefully"). Tests never report to Sentry.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  wrap: <T>(component: T): T => component,
}));

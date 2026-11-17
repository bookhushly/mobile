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

// expo-notifications: jest-expo stubs only the native module, so give every test a phone that
// has already answered (granted) unless a test says otherwise; nothing prompts by default.
jest.mock('expo-notifications', () => ({
  PermissionStatus: { UNDETERMINED: 'undetermined', GRANTED: 'granted', DENIED: 'denied' },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true, canAskAgain: true }),
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true, canAskAgain: true }),
  ),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
}));

// AsyncStorage's official in-memory mock, so code reading plain device storage works in tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);


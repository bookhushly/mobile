import { unstable_settings } from '@/app/_layout';

jest.mock('@sentry/react-native', () => ({ wrap: (c: unknown) => c }));
jest.mock('@/shared/monitoring', () => ({ initMonitoring: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// When signing in hides the sign-in screens before the account's mode has loaded, the root stack
// falls back to its initial route. Without one it took the first declared screen, the unguarded
// delete-account modal (2026-10-21 device report). It must fall back to the index redirect.
it('falls back to the index route, never to a declared modal', () => {
  expect(unstable_settings).toEqual({ initialRouteName: 'index' });
});

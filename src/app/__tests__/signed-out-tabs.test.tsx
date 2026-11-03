import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import AccountRoute from '../(customer)/(tabs)/account';
import BookingsRoute from '../(customer)/(tabs)/bookings';
import SavedRoute from '../(customer)/(tabs)/saved';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: (pick: (s: { state: { status: 'signedOut' } }) => unknown) =>
    pick({ state: { status: 'signedOut' } }),
}));
const mockHook = jest.fn();
jest.mock('@/features/auth/hooks/useSignOut', () => ({
  useSignOut: () => {
    mockHook('useSignOut');
    return jest.fn();
  },
}));
jest.mock('@/features/mode/hooks/useModeSwitcher', () => ({
  useModeSwitcher: () => {
    mockHook('useModeSwitcher');
    return { modes: [], choose: jest.fn() };
  },
}));
jest.mock('@/features/customer/screens/SavedScreen', () => ({
  SavedScreen: () => {
    mockHook('SavedScreen');
    return null;
  },
}));
jest.mock('@/features/customer/screens/BookingsScreen', () => ({
  BookingsScreen: () => {
    mockHook('BookingsScreen');
    return null;
  },
}));
jest.mock('@/features/customer/screens/AccountScreen', () => ({
  AccountScreen: () => {
    mockHook('AccountScreen');
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it.each([
  ['saved', SavedRoute, 'Your saved places live here'],
  ['bookings', BookingsRoute, 'Your bookings live here'],
  ['account', AccountRoute, 'Your account lives here'],
])('%s signed out shows the sign-in tab and mounts no account hooks', async (_n, Route, title) => {
  await render(<Route />);
  expect(screen.getByText(title)).toBeTruthy();
  expect(mockHook).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Sign in'));
  await fireEvent.press(screen.getByText('Create account'));
  expect(router.push).toHaveBeenCalledWith('/sign-in');
  expect(router.push).toHaveBeenCalledWith('/sign-up');
});

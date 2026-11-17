import { render } from '@testing-library/react-native';

import AuthLayout from '@/app/(auth)/_layout';
import type { SavedInput } from '@/features/customer/api/savedDb';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';

jest.mock('expo-router', () => {
  const Stack = () => null;
  return {
    Stack,
    ThemeProvider: ({ children }: { children: unknown }) => children,
    DefaultTheme: { colors: {} },
  };
});
jest.mock('@/features/auth/components/AuthBackdrop', () => ({ AuthBackdrop: () => null }));
jest.mock('@/shared/supabase/client', () => ({ supabase: { auth: {} } }));

const HOTEL: SavedInput = {
  listingId: 'h1',
  kind: 'hotel',
  title: 'Harbour Suites',
  image: null,
  location: 'Ikeja, Lagos',
};

beforeEach(() => {
  useSignInPrompt.setState({ reason: null, pendingSave: HOTEL });
});

it('clears the pending save when the auth screens close while still signed out', async () => {
  useAuth.setState({ state: { status: 'signedOut' }, recovery: false });
  const { unmount } = await render(<AuthLayout />);
  expect(useSignInPrompt.getState().pendingSave).toEqual(HOTEL);
  await unmount();
  expect(useSignInPrompt.getState().pendingSave).toBeNull();
});

it('keeps the pending save when they close because of a sign-in', async () => {
  useAuth.setState({ state: { status: 'signedOut' }, recovery: false });
  const { unmount } = await render(<AuthLayout />);
  useAuth.setState({ state: { status: 'signedIn', userId: 'u1', email: 'a@b.co' } });
  await unmount();
  expect(useSignInPrompt.getState().pendingSave).toEqual(HOTEL);
});

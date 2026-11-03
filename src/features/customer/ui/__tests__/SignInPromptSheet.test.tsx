import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { act } from 'react';
import { Platform } from 'react-native';

import type { SavedInput } from '@/features/customer/api/savedDb';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { SignInPromptSheet } from '@/features/customer/ui/SignInPromptSheet';

// The RN Modal mock renders nothing once hidden, so the last props are kept to fire a dismissal.
const mockSheet: { last: { visible: boolean; title: string; onDismissed?: () => void } | null } = {
  last: null,
};
jest.mock('@/shared/ui/Sheet', () => {
  const actual = jest.requireActual<typeof import('@/shared/ui/Sheet')>('@/shared/ui/Sheet');
  return {
    Sheet: (props: ComponentProps<typeof actual.Sheet>) => {
      mockSheet.last = props;
      return <actual.Sheet {...props} />;
    },
  };
});

const HOTEL: SavedInput = {
  listingId: 'h1',
  kind: 'hotel',
  title: 'Harbour Suites',
  image: null,
  location: 'Ikeja, Lagos',
};

const onCreateAccount = jest.fn();
const onSignIn = jest.fn();
const mount = () =>
  render(<SignInPromptSheet onCreateAccount={onCreateAccount} onSignIn={onSignIn} />);
const dismissed = async () => {
  await act(async () => {
    mockSheet.last?.onDismissed?.();
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  useSignInPrompt.setState({ reason: null, pendingSave: null });
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('stays closed until asked', async () => {
  await mount();
  expect(screen.queryByText('Create account')).toBeNull();
});

it('shows the book copy', async () => {
  useSignInPrompt.getState().ask('book');
  await mount();
  expect(screen.getByText('Sign in to book')).toBeTruthy();
  expect(
    screen.getByText(
      'We keep your booking and tickets in your account. Your dates and room stay as you chose them.',
    ),
  ).toBeTruthy();
  expect(screen.getByText('Create account')).toBeTruthy();
  expect(screen.getByText('Sign in')).toBeTruthy();
  expect(screen.getByText('Not now')).toBeTruthy();
});

it('shows the save copy', async () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  await mount();
  expect(screen.getByText('Sign in to save')).toBeTruthy();
  expect(
    screen.getByText('We’ll save this to your account as soon as you’ve signed in.'),
  ).toBeTruthy();
});

it('Not now closes and forgets the pending save', async () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  await mount();
  await fireEvent.press(screen.getByText('Not now'));
  expect(useSignInPrompt.getState()).toMatchObject({ reason: null, pendingSave: null });
  await dismissed();
  expect(onSignIn).not.toHaveBeenCalled();
  expect(onCreateAccount).not.toHaveBeenCalled();
});

it('Sign in closes, keeps the pending save, and calls onSignIn', async () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  await mount();
  await fireEvent.press(screen.getByText('Sign in'));
  expect(useSignInPrompt.getState()).toMatchObject({ reason: null, pendingSave: HOTEL });
  await dismissed();
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(onCreateAccount).not.toHaveBeenCalled();
});

it('on iOS navigates only after the sheet has gone, and once', async () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  await mount();
  await fireEvent.press(screen.getByText('Create account'));
  expect(onCreateAccount).not.toHaveBeenCalled();
  await dismissed();
  expect(onCreateAccount).toHaveBeenCalledTimes(1);
  await dismissed();
  expect(onCreateAccount).toHaveBeenCalledTimes(1);
});

it('on Android navigates straight away', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  useSignInPrompt.getState().ask('save', HOTEL);
  await mount();
  await fireEvent.press(screen.getByText('Sign in'));
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(useSignInPrompt.getState()).toMatchObject({ reason: null, pendingSave: HOTEL });
});

it('keeps its title while sliding away', async () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  await mount();
  await fireEvent.press(screen.getByText('Not now'));
  expect(mockSheet.last).toMatchObject({ visible: false, title: 'Sign in to save' });
});

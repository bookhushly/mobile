import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';

import type { ProfileInput } from '@/features/customer/api/customerDb';
import type { WriteOutcome } from '@/features/customer/hooks/sessionWrite';
import { useProfile, useSaveProfile } from '@/features/customer/hooks/useProfile';
import { AccountScreen } from '@/features/customer/screens/AccountScreen';
import type { ProfileRow } from '@/features/customer/schemas/profile';
import { Text } from '@/shared/ui';

jest.mock('@/features/customer/hooks/useProfile', () => ({
  useProfile: jest.fn(),
  useSaveProfile: jest.fn(),
}));
jest.mock('@/shared/api/instance', () => ({ APP_VERSION: '1.2.3' }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })),
}));

const full: ProfileRow = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  phone: '+2348031234567',
  state: 'Lagos',
  address: '12 Marina Road',
};
const empty: ProfileRow = { ...full, phone: null, state: null, address: null };

let save: jest.Mock<Promise<WriteOutcome>, [ProfileInput]>;

function withProfile(p: ProfileRow | null, over: Partial<ReturnType<typeof useProfile>> = {}) {
  jest.mocked(useProfile).mockReturnValue({
    profile: p,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    ...over,
  });
}

async function open(over: { modeSwitcher?: React.ReactNode } = {}) {
  const h = { onSignOut: jest.fn(), onDeleteAccount: jest.fn() };
  await render(<AccountScreen userId="u1" email="ada@example.com" {...h} {...over} />);
  return h;
}

type Node = { type: unknown; parent: Node | null };
// Is there a scroll view between this element and its sheet (the Modal)?
function scrollsInSheet(el: Node): boolean {
  let n: Node | null = el.parent;
  for (let i = 0; n !== null && i < 100; i++, n = n.parent) {
    if (n.type === 'Modal') return false;
    if (n.type === 'RCTScrollView') return true;
  }
  return false;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  save = jest.fn<Promise<WriteOutcome>, [ProfileInput]>(() => Promise.resolve('ok'));
  jest.mocked(useSaveProfile).mockReturnValue({ save, saving: false });
});

afterEach(() => {
  jest.useRealTimers();
});

it('shows the header, each detail, help links and the version', async () => {
  withProfile(full);
  await open({ modeSwitcher: <Text>Mode switcher here</Text> });
  expect(screen.getByText('AL', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Ada Lovelace' })).toBeTruthy();
  expect(screen.getByText('ada@example.com')).toBeTruthy();
  expect(screen.getByText('Mode switcher here')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Name, Ada Lovelace, edit' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Phone, 0803 123 4567, edit' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'State, Lagos, edit' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Address, 12 Marina Road, edit' })).toBeTruthy();
  expect(screen.getByText('Version 1.2.3')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Help, opens bookhushly.com' }));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://bookhushly.com/help');
  await fireEvent.press(screen.getByRole('button', { name: 'Terms, opens bookhushly.com' }));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://bookhushly.com/terms');
  await fireEvent.press(screen.getByRole('button', { name: 'Privacy, opens bookhushly.com' }));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://bookhushly.com/privacy');
});

it('unset details read "Add"', async () => {
  withProfile(empty);
  await open();
  expect(screen.getAllByText('Add')).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Phone, not set, edit' })).toBeTruthy();
});

it('falls back to the email letter for the avatar', async () => {
  withProfile({ ...empty, name: '' });
  await open();
  expect(screen.getByText('A', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Account' })).toBeTruthy();
});

it('says so when the details could not load', async () => {
  const refetch = jest.fn(() => Promise.resolve());
  withProfile(null, { error: true, refetch });
  await open();
  expect(screen.getByText('Couldn’t load your details')).toBeTruthy();
});

it('validates the phone on blur and saves it as E.164 with only the four fields', async () => {
  withProfile(empty);
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Phone, not set, edit' }));
  const input = screen.getByLabelText('Phone number');
  await fireEvent.changeText(input, '12345');
  await fireEvent(input, 'blur');
  expect(screen.getByText('Enter a Nigerian number, like 0803 123 4567')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(save).not.toHaveBeenCalled();

  await fireEvent.changeText(input, '803 123 4567');
  await fireEvent(input, 'blur');
  expect(screen.queryByText('Enter a Nigerian number, like 0803 123 4567')).toBeNull();
  expect(screen.getByDisplayValue('0803 123 4567')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith({
    name: 'Ada Lovelace',
    phone: '+2348031234567',
    state: null,
    address: null,
  });
});

it('an empty phone clears it', async () => {
  withProfile(full);
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Phone, 0803 123 4567, edit' }));
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith({
    name: 'Ada Lovelace',
    phone: null,
    state: 'Lagos',
    address: '12 Marina Road',
  });
});

it('the name is required (2 to 80 characters) and saved trimmed', async () => {
  withProfile(full);
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Name, Ada Lovelace, edit' }));
  const input = screen.getByLabelText('Full name');
  await fireEvent.changeText(input, ' A ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Enter your name (2 to 80 characters)')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  await fireEvent.changeText(input, '  Ada King ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith({
    name: 'Ada King',
    phone: '+2348031234567',
    state: 'Lagos',
    address: '12 Marina Road',
  });
});

it('picks a state from a searchable list', async () => {
  withProfile(full);
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'State, Lagos, edit' }));
  expect(screen.getByRole('radio', { name: 'Lagos', checked: true })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search states'), 'kan');
  expect(screen.queryByRole('radio', { name: 'Lagos' })).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Kano' }));
  expect(screen.getByRole('radio', { name: 'Kano', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith({
    name: 'Ada Lovelace',
    phone: '+2348031234567',
    state: 'Kano',
    address: '12 Marina Road',
  });
});

it('a failed save keeps the input and says why', async () => {
  withProfile(full);
  save.mockResolvedValueOnce('transient').mockResolvedValueOnce('stale');
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Address, 12 Marina Road, edit' }));
  const input = screen.getByLabelText('Address');
  await fireEvent.changeText(input, '1 New Street');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(
    await screen.findByText('Couldn’t save. Check your connection and try again.'),
  ).toBeTruthy();
  expect(screen.getByDisplayValue('1 New Street')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Please sign in again')).toBeTruthy();
  expect(save).toHaveBeenLastCalledWith({
    name: 'Ada Lovelace',
    phone: '+2348031234567',
    state: 'Lagos',
    address: '1 New Street',
  });
});

it('a saved edit closes the sheet', async () => {
  withProfile(full);
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Address, 12 Marina Road, edit' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => {
    expect(screen.queryByLabelText('Address')).toBeNull();
  });
});

it('sign out and delete account call back', async () => {
  withProfile(full);
  const h = await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(h.onSignOut).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('link', { name: 'Delete account' }));
  expect(h.onDeleteAccount).toHaveBeenCalled();
});

it('text fields scroll in their sheet; the state list keeps its own list', async () => {
  withProfile(full);
  await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Address, 12 Marina Road, edit' }));
  expect(scrollsInSheet(screen.getByLabelText('Address') as unknown as Node)).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await fireEvent.press(screen.getByRole('button', { name: 'State, Lagos, edit' }));
  expect(scrollsInSheet(screen.getByLabelText('Search states') as unknown as Node)).toBe(false);
});

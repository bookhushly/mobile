import { fireEvent, render, screen } from '@testing-library/react-native';
import { X } from 'lucide-react-native';
import { Keyboard, processColor, StyleSheet } from 'react-native';

import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { sheetTop } from '@/features/auth/domain/authBackdrop';
import { color } from '@/shared/theme';
import { Text } from '@/shared/ui';
import { useMotionTier } from '@/shared/ui/motion';

jest.mock('@/shared/ui/motion', () => ({ useMotionTier: jest.fn() }));
const tierMock = jest.mocked(useMotionTier);

function translateY(): number {
  const flat = StyleSheet.flatten(screen.getByTestId('auth-sheet').props.style) as {
    transform?: { translateY?: number }[];
  };
  return flat.transform?.[0]?.translateY ?? Number.NaN;
}

beforeEach(() => {
  tierMock.mockReturnValue('none');
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('renders children and footer', async () => {
  await render(
    <AuthSheet footer={<Text>Foot</Text>}>
      <Text>Body</Text>
    </AuthSheet>,
  );
  expect(screen.getByText('Body')).toBeTruthy();
  expect(screen.getByText('Foot')).toBeTruthy();
});

it('shows the leave button only with onLeave', async () => {
  const onLeave = jest.fn();
  const view = await render(
    <AuthSheet>
      <Text>Body</Text>
    </AuthSheet>,
  );
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  await view.rerender(
    <AuthSheet onLeave={onLeave}>
      <Text>Body</Text>
    </AuthSheet>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onLeave).toHaveBeenCalled();
});

it('honours leaveIcon and leaveLabel', async () => {
  await render(
    <AuthSheet onLeave={jest.fn()} leaveIcon={X} leaveLabel="Cancel">
      <Text>Body</Text>
    </AuthSheet>,
  );
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
});

it('keeps taps working while the keyboard is open', async () => {
  await render(
    <AuthSheet>
      <Text>Body</Text>
    </AuthSheet>,
  );
  expect(screen.getByTestId('auth-sheet-scroll').props.keyboardShouldPersistTaps).toBe('handled');
});

it('skips the slide at tier none', async () => {
  await render(
    <AuthSheet>
      <Text>Body</Text>
    </AuthSheet>,
  );
  expect(translateY()).toBe(sheetTop(0));
});

it('puts the leave button first for screen readers', async () => {
  await render(
    <AuthSheet onLeave={jest.fn()}>
      <Text>Body</Text>
    </AuthSheet>,
  );
  const leave = screen.getByTestId('auth-leave');
  const logo = screen.getByTestId('auth-sheet-logo', { includeHiddenElements: true });
  const header = leave.parent;
  // Same row; the leave button comes before the logo in reading order.
  expect(header?.children.indexOf(leave)).toBe(0);
  expect(logo).toBeTruthy();
});

// Owner, 2026-11-23: one logo colour rule. On the white sheet the mark is brand violet, never ink.
it('draws the logo in brand violet on the white sheet', async () => {
  await render(
    <AuthSheet>
      <Text>Body</Text>
    </AuthSheet>,
  );
  const logo = screen.getByTestId('auth-sheet-logo', { includeHiddenElements: true });
  // The image view receives the colour as a native value.
  expect(logo.props.tintColor).toBe(processColor(color.brand));
});

it('opens raised with no slide on a screen that focuses a field on arrival', async () => {
  tierMock.mockReturnValue('full');
  await render(
    <AuthSheet startRaised>
      <Text>Body</Text>
    </AuthSheet>,
  );
  expect(translateY()).toBe(sheetTop(0));
});

it('heads every form with the logo, without making it a screen-reader stop', async () => {
  await render(
    <AuthSheet>
      <Text>Body</Text>
    </AuthSheet>,
  );
  expect(screen.getByTestId('auth-sheet-logo', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByRole('image', { name: 'Bookhushly' })).toBeNull();
});

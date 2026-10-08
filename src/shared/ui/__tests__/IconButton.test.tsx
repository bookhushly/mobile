import { fireEvent, render, screen } from '@testing-library/react-native';
import { Flashlight, Search } from 'lucide-react-native';

import { space } from '@/shared/theme';
import { DensityProvider } from '@/shared/ui/DensityProvider';
import { IconButton } from '@/shared/ui/IconButton';
import { TextLink } from '@/shared/ui/TextLink';
import { ToggleButton } from '@/shared/ui/ToggleButton';

it('icon button is a labelled button with a visible label under it', async () => {
  const onPress = jest.fn();
  await render(
    <IconButton
      icon={Search}
      accessibilityLabel="Find guest"
      label="Find guest"
      onPress={onPress}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Find guest' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Find guest')).toBeTruthy();
});

it('large icon button is 64 round under gate density', async () => {
  await render(
    <DensityProvider density="gate">
      <IconButton icon={Search} accessibilityLabel="Find guest" size="lg" onPress={jest.fn()} />
    </DensityProvider>,
  );
  expect(screen.getByTestId('icon-button-face')).toHaveStyle({
    width: 64,
    height: 64,
    borderRadius: 32,
  });
});

it('medium icon button is 48 with hit slop to 56 under gate density', async () => {
  await render(
    <DensityProvider density="gate">
      <IconButton icon={Search} accessibilityLabel="Find guest" onPress={jest.fn()} />
    </DensityProvider>,
  );
  expect(screen.getByTestId('icon-button-face')).toHaveStyle({ width: 48, height: 48 });
  expect(screen.getByRole('button', { name: 'Find guest' }).props.hitSlop).toBe(4);
});

it('disabled icon button reports the state and ignores presses', async () => {
  const onPress = jest.fn();
  await render(
    <IconButton icon={Search} accessibilityLabel="Find guest" disabled onPress={onPress} />,
  );
  const b = screen.getByRole('button', { name: 'Find guest' });
  expect(b).toBeDisabled();
  await fireEvent.press(b);
  expect(onPress).not.toHaveBeenCalled();
});

it('toggle is a switch that reports checked and flips', async () => {
  const onChange = jest.fn();
  await render(
    <ToggleButton icon={Flashlight} label="Torch" checked={false} onChange={onChange} />,
  );
  const sw = screen.getByRole('switch', { name: 'Torch' });
  expect(sw).not.toBeChecked();
  await fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(true);
});

it('toggle flips back to off when checked and can hide its visible label', async () => {
  const onChange = jest.fn();
  await render(
    <ToggleButton icon={Flashlight} label="Torch" hideLabel checked onChange={onChange} />,
  );
  const sw = screen.getByRole('switch', { name: 'Torch' });
  expect(sw).toBeChecked();
  expect(screen.queryByText('Torch')).toBeNull();
  await fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(false);
});

it('text link has a 44 pt target', async () => {
  await render(<TextLink label="Change event" onPress={jest.fn()} />);
  expect(screen.getByRole('link', { name: 'Change event' })).toHaveStyle({ minHeight: 44 });
});

it('text link fires onPress', async () => {
  const onPress = jest.fn();
  await render(<TextLink label="Change event" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('link', { name: 'Change event' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

// PressableScale wraps its children in one Animated.View, so the face and label must share
// an inner View that centres them and spaces them with the s2 gap.
it('icon button centres face and label in one inner view with the s2 gap', async () => {
  await render(
    <IconButton
      icon={Search}
      accessibilityLabel="Find guest"
      label="Find guest"
      onPress={jest.fn()}
    />,
  );
  const column = screen.getByTestId('icon-button-face').parent;
  expect(column).toHaveStyle({ alignItems: 'center', gap: space.s2 });
  expect(column).toContainElement(screen.getByText('Find guest'));
  expect(screen.getByText('Find guest')).toHaveStyle({ textAlign: 'center' });
});

it('toggle centres face and label in one inner view with the s2 gap', async () => {
  await render(
    <ToggleButton icon={Flashlight} label="Torch" checked={false} onChange={jest.fn()} />,
  );
  const column = screen.getByTestId('toggle-button-face').parent;
  expect(column).toHaveStyle({ alignItems: 'center', gap: space.s2 });
  expect(column).toContainElement(screen.getByText('Torch'));
  expect(screen.getByText('Torch')).toHaveStyle({ textAlign: 'center' });
});

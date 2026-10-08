import { fireEvent, render, screen } from '@testing-library/react-native';

import { color } from '@/shared/theme';
import { Button } from '@/shared/ui';
import { DensityProvider } from '@/shared/ui/DensityProvider';

it('calls onPress and exposes button role/label', async () => {
  const onPress = jest.fn();
  await render(<Button label="Sign in" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('does not fire while loading', async () => {
  const onPress = jest.fn();
  await render(<Button label="Sign in" onPress={onPress} loading />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(onPress).not.toHaveBeenCalled();
});

it('uses accessibilityLabel for screen readers when given', async () => {
  await render(<Button label="Admit" accessibilityLabel="Admit Ada, VIP" onPress={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Admit Ada, VIP' })).toBeTruthy();
  expect(screen.getByText('Admit')).toBeTruthy();
});

it('is 64 tall under gate density', async () => {
  await render(
    <DensityProvider density="gate">
      <Button label="Confirm" onPress={jest.fn()} />
    </DensityProvider>,
  );
  expect(screen.getByRole('button', { name: 'Confirm' })).toHaveStyle({ minHeight: 64 });
});

it('keeps the label visible while busy and blocks presses', async () => {
  const onPress = jest.fn();
  await render(<Button label="Confirm" loading onPress={onPress} />);
  const b = screen.getByRole('button', { name: 'Confirm' });
  expect(screen.getByText('Confirm')).toBeTruthy();
  expect(b).toBeBusy();
  expect(b).toBeDisabled();
  await fireEvent.press(b);
  expect(onPress).not.toHaveBeenCalled();
});

it('destructive uses the danger fill', async () => {
  await render(<Button label="Sign out" variant="destructive" onPress={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Sign out' })).toHaveStyle({
    backgroundColor: color.status.danger.solid,
  });
});

it('disabled is a muted fill with disabled state, not half opacity', async () => {
  const onPress = jest.fn();
  await render(<Button label="Confirm" disabled onPress={onPress} />);
  const b = screen.getByRole('button', { name: 'Confirm' });
  expect(b).toBeDisabled();
  expect(b).toHaveStyle({ backgroundColor: color.wash });
  expect(b).not.toHaveStyle({ opacity: 0.5 });
  await fireEvent.press(b);
  expect(onPress).not.toHaveBeenCalled();
});

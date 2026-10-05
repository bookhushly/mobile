import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/shared/ui';

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

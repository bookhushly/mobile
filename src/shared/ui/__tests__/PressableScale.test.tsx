import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { PressableScale } from '@/shared/ui/PressableScale';

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

it('renders its children and forwards presses', async () => {
  const onPress = jest.fn();
  await render(
    <PressableScale accessibilityRole="button" onPress={onPress}>
      <Text>Admit</Text>
    </PressableScale>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Admit' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('calls the caller’s onPressIn and onPressOut', async () => {
  const onPressIn = jest.fn();
  const onPressOut = jest.fn();
  await render(
    <PressableScale onPressIn={onPressIn} onPressOut={onPressOut}>
      <Text>Scan</Text>
    </PressableScale>,
  );
  await fireEvent(screen.getByText('Scan'), 'pressIn');
  await fireEvent(screen.getByText('Scan'), 'pressOut');
  expect(onPressIn).toHaveBeenCalledTimes(1);
  expect(onPressOut).toHaveBeenCalledTimes(1);
});

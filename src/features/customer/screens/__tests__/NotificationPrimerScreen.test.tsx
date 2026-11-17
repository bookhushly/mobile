import { fireEvent, render, screen } from '@testing-library/react-native';

import { NotificationPrimerScreen } from '@/features/customer/screens/NotificationPrimerScreen';

it('says what arrives and offers yes or not now', async () => {
  const onTurnOn = jest.fn();
  const onNotNow = jest.fn();
  await render(<NotificationPrimerScreen onTurnOn={onTurnOn} onNotNow={onNotNow} />);
  expect(screen.getByRole('header', { name: 'Know before you go' })).toBeTruthy();
  expect(screen.getByRole('image', { name: /Example notifications/ })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));
  expect(onTurnOn).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('link', { name: 'Not now' }));
  expect(onNotNow).toHaveBeenCalled();
});

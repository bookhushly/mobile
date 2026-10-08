import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScreenError } from '@/shared/ui/ScreenError';

it('offers a retry, never promises data is safe, and never shows the raw error text', async () => {
  const retry = jest.fn();
  await render(<ScreenError error={new Error('secret stack detail')} retry={retry} />);
  expect(screen.getByText('Something went wrong')).toBeTruthy();
  expect(screen.queryByText(/safe/i)).toBeNull();
  expect(screen.queryByText(/secret stack detail/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

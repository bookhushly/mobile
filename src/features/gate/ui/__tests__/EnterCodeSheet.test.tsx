import { fireEvent, render, screen } from '@testing-library/react-native';

import { EnterCodeSheet } from '@/features/gate/ui/EnterCodeSheet';

it('rejects input that is not a ticket inline, without submitting', async () => {
  const onSubmit = jest.fn();
  await render(<EnterCodeSheet visible onSubmit={onSubmit} onClose={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Ticket code or link'), 'hello');
  await fireEvent.press(screen.getByRole('button', { name: 'Check ticket' }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('That is not a Bookhushly ticket code or link.')).toBeTruthy();
});

it('submits a pasted link', async () => {
  const onSubmit = jest.fn();
  const link = 'https://bookhushly.com/t/3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  await render(<EnterCodeSheet visible onSubmit={onSubmit} onClose={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Ticket code or link'), link);
  await fireEvent.press(screen.getByRole('button', { name: 'Check ticket' }));
  expect(onSubmit).toHaveBeenCalledWith(link);
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

it('is a radio group with the current mode checked', async () => {
  const onChoose = jest.fn();
  await render(<ModeSwitcher modes={['gate', 'customer']} current="gate" onChoose={onChoose} />);
  expect(screen.getByRole('radio', { name: /Gate staff/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: /Customer/ })).not.toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: /Customer/ }));
  expect(onChoose).toHaveBeenCalledWith('customer');
});

it('describes each mode in one line', async () => {
  await render(
    <ModeSwitcher modes={['customer', 'gate', 'receptionist']} current="gate" onChoose={jest.fn()} />,
  );
  expect(screen.getByText('Book and see your tickets')).toBeTruthy();
  expect(screen.getByText('Scan tickets at the door')).toBeTruthy();
  expect(screen.getByText('Check in hotel guests')).toBeTruthy();
});

it('renders nothing with only one mode', async () => {
  await render(<ModeSwitcher modes={['gate']} current="gate" onChoose={jest.fn()} />);
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.queryByText('Mode')).toBeNull();
});

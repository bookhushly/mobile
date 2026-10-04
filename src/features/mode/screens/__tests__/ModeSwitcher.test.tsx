import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

it('renders nothing when there is only one mode', async () => {
  await render(<ModeSwitcher modes={['customer']} current="customer" onChoose={jest.fn()} />);
  expect(screen.queryByText('Switch mode')).toBeNull();
});

it('lists every available mode and reports the choice', async () => {
  const onChoose = jest.fn();
  await render(<ModeSwitcher modes={['gate', 'customer']} current="gate" onChoose={onChoose} />);
  expect(screen.getByText('Switch mode')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Customer' }));
  expect(onChoose).toHaveBeenCalledWith('customer');
});

it('marks the current mode as selected', async () => {
  await render(<ModeSwitcher modes={['gate', 'customer']} current="gate" onChoose={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Gate staff' }).props.accessibilityState).toMatchObject(
    {
      selected: true,
    },
  );
});

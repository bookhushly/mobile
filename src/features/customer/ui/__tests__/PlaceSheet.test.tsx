import { fireEvent, render, screen } from '@testing-library/react-native';

import { PlaceSheet } from '@/features/customer/ui/PlaceSheet';

const props = () => ({
  visible: true,
  current: { label: 'Lagos', state: 'Lagos' },
  onChoose: jest.fn(),
  onClose: jest.fn(),
});

it('popular places show the state they sit in, and the current one is ticked once', async () => {
  await render(<PlaceSheet {...props()} />);
  expect(screen.getByRole('radio', { name: 'Port Harcourt, Rivers State' })).toBeTruthy();
  const lagos = screen.getAllByRole('radio', { checked: true });
  expect(lagos).toHaveLength(1);
});

it('the search narrows both lists by name or state, and says when nothing matches', async () => {
  await render(<PlaceSheet {...props()} />);
  await fireEvent.changeText(screen.getByLabelText('Find a city or state'), 'rivers');
  expect(screen.getByRole('radio', { name: 'Port Harcourt, Rivers State' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Rivers' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Lagos, Lagos State' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Find a city or state'), 'zzz');
  expect(screen.getByText('No city or state matches “zzz”.')).toBeTruthy();
});

it('choosing a place hands it back', async () => {
  const p = props();
  await render(<PlaceSheet {...p} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Abuja, Federal Capital Territory' }));
  expect(p.onChoose).toHaveBeenCalledWith({ label: 'Abuja', state: 'FCT' });
});

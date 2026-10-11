import { fireEvent, render, screen } from '@testing-library/react-native';

import type { DeskHotel } from '@/features/receptionist/hooks/useHotel';
import { HotelGateScreen } from '@/features/receptionist/screens/HotelGateScreen';

const hotels: DeskHotel[] = [
  { id: 'h1', name: 'Eko Suites', place: 'Ikeja, Lagos' },
  { id: 'h2', name: 'Bay Lodge', place: '' },
];

it('says it is loading the hotel', async () => {
  await render(<HotelGateScreen state={{ status: 'loading' }} onSignOut={jest.fn()} />);
  expect(screen.getByText('Loading your hotel…')).toBeTruthy();
});

it('offers Try again on a load failure', async () => {
  const retry = jest.fn();
  await render(<HotelGateScreen state={{ status: 'error', retry }} onSignOut={jest.fn()} />);
  expect(screen.getByText("Couldn't load your hotel")).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('explains no hotel assigned and lets the user sign out', async () => {
  const onSignOut = jest.fn();
  await render(<HotelGateScreen state={{ status: 'none' }} onSignOut={onSignOut} />);
  expect(screen.getByText('No hotel assigned')).toBeTruthy();
  expect(screen.getByText('Ask the hotel owner to add you as front desk staff.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalledTimes(1);
});

it('explains an unavailable hotel and lets the user sign out', async () => {
  const onSignOut = jest.fn();
  await render(<HotelGateScreen state={{ status: 'unavailable' }} onSignOut={onSignOut} />);
  expect(screen.getByText("This hotel isn't available right now")).toBeTruthy();
  expect(screen.getByText('Contact the hotel owner.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalledTimes(1);
});

it('lists the hotels to choose from and reports the choice', async () => {
  const choose = jest.fn();
  await render(
    <HotelGateScreen state={{ status: 'pick', hotels, choose }} onSignOut={jest.fn()} />,
  );
  expect(screen.getByRole('header', { name: 'Choose a hotel' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Eko Suites, Ikeja, Lagos' }));
  expect(choose).toHaveBeenCalledWith('h1');
  await fireEvent.press(screen.getByRole('button', { name: 'Bay Lodge' }));
  expect(choose).toHaveBeenCalledWith('h2');
});

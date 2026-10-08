import { fireEvent, render, screen } from '@testing-library/react-native';

import { RecentSheet } from '@/features/gate/ui/RecentSheet';

it('marks admissions made on this account', async () => {
  await render(
    <RecentSheet
      visible
      onClose={jest.fn()}
      recent={[
        {
          id: 'a',
          ticket_type: 'VIP',
          checked_in_at: '2026-10-05T18:04:00.000Z',
          scanned_by_me: true,
        },
        {
          id: 'b',
          ticket_type: null,
          checked_in_at: '2026-10-05T18:01:00.000Z',
          scanned_by_me: false,
        },
      ]}
    />,
  );
  expect(screen.getByText('VIP')).toBeTruthy();
  expect(screen.getByText('Ticket')).toBeTruthy();
  expect(screen.getAllByText('By me')).toHaveLength(1);
  expect(screen.getAllByTestId('status-pill')).toHaveLength(1);
});

it('says when nothing has been admitted yet', async () => {
  await render(<RecentSheet visible onClose={jest.fn()} recent={[]} />);
  expect(screen.getByText('No admissions yet')).toBeTruthy();
});

it('says when the list has not loaded', async () => {
  await render(<RecentSheet visible onClose={jest.fn()} recent={null} />);
  expect(screen.getByText('Not loaded yet.')).toBeTruthy();
});

it('closes from the header', async () => {
  const onClose = jest.fn();
  await render(<RecentSheet visible onClose={onClose} recent={[]} />);
  expect(screen.getByRole('header', { name: 'Recent admissions' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

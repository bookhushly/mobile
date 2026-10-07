import { render, screen } from '@testing-library/react-native';

import { AttentionSheet } from '@/features/gate/ui/AttentionSheet';
import type { AttentionItem } from '@/features/gate/offline/outboxStore';

const item: AttentionItem = {
  seq: 1,
  eventId: 'e',
  ticketId: 't',
  code: 't',
  scannedAt: '2026-10-07T18:00:00Z',
  mode: 'offline',
  kid: null,
  appVersion: '1',
  state: 'duplicate',
  attempts: 0,
  nextTryAt: 0,
  result: { scanned_by: 'Ada', checked_in_at: '2026-10-07T17:55:00Z' },
  ticketType: 'VIP',
  ticketIndex: 2,
};

it('lists items that need attention, read-only', async () => {
  await render(<AttentionSheet visible load={() => Promise.resolve([item])} onClose={jest.fn()} />);
  expect(await screen.findByText('VIP · ticket 2')).toBeTruthy();
  expect(screen.getByText(/^Also admitted by Ada/)).toBeTruthy();
  expect(
    screen.getByText('The organiser sees these on the web. Nothing to undo here.'),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
});

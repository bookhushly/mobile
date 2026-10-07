import { fireEvent, render, screen } from '@testing-library/react-native';

import { EMPTY_SYNC } from '@/features/gate/domain/syncLine';
import { useSyncView } from '@/features/gate/state/syncView';
import { SyncBar } from '@/features/gate/ui/SyncBar';

const NOW = Date.parse('2026-10-07T18:10:00Z');

describe('SyncBar', () => {
  beforeEach(() => {
    useSyncView.setState({
      status: { ...EMPTY_SYNC, list: { count: 3, syncedAt: NOW }, pending: 2, attention: 1 },
    });
  });
  it('shows the status and the actions', async () => {
    const onSyncNow = jest.fn();
    const onOpenAttention = jest.fn();
    await render(
      <SyncBar
        nowMs={NOW}
        onRefreshList={jest.fn()}
        onSyncNow={onSyncNow}
        onOpenAttention={onOpenAttention}
      />,
    );
    expect(screen.getByText('Online · offline list 3 · just now · 2 to sync')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    expect(onSyncNow).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '1 needs attention' }));
    expect(onOpenAttention).toHaveBeenCalled();
  });
});

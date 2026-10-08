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
    const onOpenActivity = jest.fn();
    await render(
      <SyncBar
        now={() => NOW}
        onRefreshList={jest.fn()}
        onSyncNow={onSyncNow}
        onOpenActivity={onOpenActivity}
      />,
    );
    expect(screen.getByText('Online · offline list 3 · just now · 2 to sync')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    expect(onSyncNow).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '1 needs attention' }));
    expect(onOpenActivity).toHaveBeenLastCalledWith('attention');
    await fireEvent.press(screen.getByRole('button', { name: 'Activity' }));
    expect(onOpenActivity).toHaveBeenLastCalledWith('toSync');
  });
  it('opens Activity on the synced tab when nothing is waiting', async () => {
    useSyncView.setState({ status: { ...EMPTY_SYNC, list: { count: 3, syncedAt: NOW } } });
    const onOpenActivity = jest.fn();
    await render(
      <SyncBar now={() => NOW} onRefreshList={jest.fn()} onSyncNow={jest.fn()} onOpenActivity={onOpenActivity} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Activity' }));
    expect(onOpenActivity).toHaveBeenCalledWith('synced');
  });
  it('measures "ago" on the server clock, not the phone clock', async () => {
    const phone = jest.spyOn(Date, 'now').mockReturnValue(NOW + 3 * 60 * 60_000);
    await render(
      <SyncBar now={() => NOW} onRefreshList={jest.fn()} onSyncNow={jest.fn()} onOpenActivity={jest.fn()} />,
    );
    expect(screen.getByText('Online · offline list 3 · just now · 2 to sync')).toBeTruthy();
    phone.mockRestore();
  });
});

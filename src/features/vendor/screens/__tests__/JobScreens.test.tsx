import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { sampleJobs, sampleMilestone, sampleStart } from '@/features/vendor/api/sampleJobs';
import type { VendorJob } from '@/features/vendor/domain/jobs';
import { JobScreen } from '@/features/vendor/screens/JobScreen';
import { JobsScreen } from '@/features/vendor/screens/JobsScreen';

jest.mock('@/shared/ui/camera', () => ({
  useCameraAccess: () => ({ permission: 'granted', canAsk: true, request: () => undefined }),
}));
jest.mock('expo-camera', () => ({ CameraView: () => null }));

const NOW = Date.parse('2026-11-29T07:20:00Z');
const noop = () => undefined;
const jobs = () => sampleJobs('logistics', NOW);
const byId = (id: string): VendorJob => {
  const j = jobs().find((x) => x.id === id);
  if (j === undefined) throw new Error('sample missing');
  return j;
};

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const screenProps = {
  busy: false,
  problem: null,
  onBack: noop,
  onHelp: noop,
  onCall: noop,
  onDirections: noop,
};

describe('JobsScreen', () => {
  it('upcoming jobs by day, your move in ink, waiting in grey', async () => {
    await render(
      <JobsScreen
        nowMs={NOW}
        tab="upcoming"
        onTab={noop}
        onOpen={noop}
        state={{ status: 'ready', jobs: jobs(), refreshing: false, refresh: noop }}
      />,
    );
    expect(screen.getByRole('header', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Ready to start')).toBeTruthy();
    expect(screen.getByText('Waiting for payment')).toBeTruthy();
    expect(screen.queryByText('Fridge to Ikorodu')).toBeNull();
  });

  it('running and done have their own lists', async () => {
    const r = await render(
      <JobsScreen
        nowMs={NOW}
        tab="running"
        onTab={noop}
        onOpen={noop}
        state={{ status: 'ready', jobs: jobs(), refreshing: false, refresh: noop }}
      />,
    );
    expect(screen.getByText('Parcel to Victoria Island')).toBeTruthy();
    await r.rerender(
      <JobsScreen
        nowMs={NOW}
        tab="done"
        onTab={noop}
        onOpen={noop}
        state={{ status: 'ready', jobs: jobs(), refreshing: false, refresh: noop }}
      />,
    );
    expect(screen.getByText('Done and paid')).toBeTruthy();
  });
});

describe('JobScreen', () => {
  it('a paid job: where it stands, the customer one tap away, money held, Start job', async () => {
    const onAction = jest.fn();
    const onCall = jest.fn();
    await render(
      <JobScreen
        {...screenProps}
        onCall={onCall}
        onAction={onAction}
        state={{ status: 'ready', job: byId('sample-job-1') }}
      />,
    );
    expect(screen.getByTestId('vendor-job-headline')).toHaveTextContent('Ready to start');
    expect(
      screen.getByText('₦76,500 is held for you. It’s released when Ada confirms the job’s done.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Call Ada Okafor'));
    expect(onCall).toHaveBeenCalledWith('+2340000000000');
    await fireEvent.press(screen.getByTestId('vendor-job-step'));
    expect(onAction).toHaveBeenCalledWith({ kind: 'start' });
  });

  it('logistics steps: picked up, then on the way, then a delivery photo', async () => {
    const onAction = jest.fn();
    const picked = byId('sample-job-2');
    const r = await render(
      <JobScreen {...screenProps} onAction={onAction} state={{ status: 'ready', job: picked }} />,
      {
        wrapper: ({ children }) => (
          <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
        ),
      },
    );
    expect(screen.getByText('Mark on the way')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vendor-job-step'));
    expect(onAction).toHaveBeenCalledWith({
      kind: 'milestone',
      milestone: 'in_transit',
      photoUri: null,
    });

    const onTheWay: VendorJob = {
      ...picked,
      milestones: { ...picked.milestones, inTransitAt: '2026-11-29T07:10:00Z' },
    };
    await r.rerender(
      <JobScreen {...screenProps} onAction={onAction} state={{ status: 'ready', job: onTheWay }} />,
    );
    expect(screen.getByTestId('vendor-job-headline')).toHaveTextContent(
      'On the way to Victoria Island',
    );
    expect(screen.getByText('Take a delivery photo')).toBeTruthy();
    onAction.mockClear();
    await fireEvent.press(screen.getByTestId('vendor-job-step'));
    // Delivered needs a photo: the camera opens instead of sending the step.
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByTestId('vendor-photo-take')).toBeTruthy();
  });

  it('before payment the phone stays hidden and there is no step', async () => {
    await render(
      <JobScreen
        {...screenProps}
        onAction={noop}
        state={{ status: 'ready', job: byId('sample-job-3') }}
      />,
    );
    expect(screen.getByText('Their phone shows once they pay')).toBeTruthy();
    expect(screen.queryByLabelText(/^Call /)).toBeNull();
    expect(screen.queryByTestId('vendor-job-step')).toBeNull();
  });

  it('a failed step on a bad connection is neutral, never a refusal', async () => {
    await render(
      <JobScreen
        {...screenProps}
        onAction={noop}
        problem={{ title: 'We couldn’t reach Bookhushly', message: 'm', transient: true }}
        state={{ status: 'ready', job: byId('sample-job-1') }}
      />,
    );
    expect(screen.getByText('We couldn’t reach Bookhushly')).toBeTruthy();
  });
});

describe('sample job steps (stand in for the web routes)', () => {
  it('delivered needs the photo, then completes the job; a repeated step is refused', () => {
    expect(sampleStart('logistics', 'sample-job-2', NOW)).toMatchObject({
      ok: false,
      error: { kind: 'conflict', code: 'wrong_status' },
    });
    expect(sampleMilestone('logistics', 'sample-job-2', 'in_transit', null, NOW).ok).toBe(true);
    expect(sampleMilestone('logistics', 'sample-job-2', 'delivered', null, NOW)).toMatchObject({
      ok: false,
      error: { code: 'photo_required' },
    });
    const done = sampleMilestone('logistics', 'sample-job-2', 'delivered', 'file:///p.jpg', NOW);
    expect(done.ok && done.value.vendorCompletedAt !== null).toBe(true);
  });
});

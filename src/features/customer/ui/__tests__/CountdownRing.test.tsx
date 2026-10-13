import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { CountdownRing } from '@/features/customer/ui/CountdownRing';
import { DensityProvider } from '@/shared/ui/DensityProvider';

jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => Date.now() } }));

const NOW = Date.parse('2026-10-13T11:00:00Z');
const hidden = { includeHiddenElements: true };

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function ring(density: 'customer' | 'work' | 'gate', reduce = false) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduce);
  const r = await render(
    <DensityProvider density={density}>
      <CountdownRing expiresAt={NOW + 20_000} />
    </DensityProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return r;
}

it('full motion (customer): the ring sweeps', async () => {
  const { unmount } = await ring('customer');
  expect(screen.getByTestId('countdown-ring-sweep', hidden)).toBeTruthy();
  await unmount();
});

it.each<['work' | 'gate']>([['work'], ['gate']])(
  'reduced motion (%s density): a still ring with the seconds, no sweep',
  async (density) => {
    const { unmount } = await ring(density);
    expect(screen.queryByTestId('countdown-ring-sweep', hidden)).toBeNull();
    expect(screen.getByTestId('countdown-ring-static', hidden)).toBeTruthy();
    expect(screen.getByText('20', hidden)).toBeTruthy();
    await unmount();
  },
);

it('Reduce Motion: a still ring', async () => {
  const { unmount } = await ring('customer', true);
  expect(screen.getByTestId('countdown-ring-static', hidden)).toBeTruthy();
  await unmount();
});

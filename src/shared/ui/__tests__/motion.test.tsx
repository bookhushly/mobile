import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { DensityProvider } from '@/shared/ui/DensityProvider';
import { useMotionTier } from '@/shared/ui/motion';

let emit: ((on: boolean) => void) | null = null;
beforeEach(() => {
  emit = null;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_e, cb) => {
    emit = cb as unknown as (on: boolean) => void;
    return { remove: jest.fn() } as unknown as ReturnType<
      typeof AccessibilityInfo.addEventListener
    >;
  });
});

function Probe() {
  return <Text>{useMotionTier()}</Text>;
}

it.each([
  ['customer', 'full'],
  ['work', 'reduced'],
  ['gate', 'reduced'],
] as const)('%s density defaults to %s', async (d, tier) => {
  await render(
    <DensityProvider density={d}>
      <Probe />
    </DensityProvider>,
  );
  expect(screen.getByText(tier)).toBeTruthy();
});

it('Reduce Motion switches to none live, and back', async () => {
  await render(<Probe />);
  expect(screen.getByText('full')).toBeTruthy();
  await act(() => {
    emit?.(true);
  });
  expect(screen.getByText('none')).toBeTruthy();
  await act(() => {
    emit?.(false);
  });
  expect(screen.getByText('full')).toBeTruthy();
});

it('reads the initial Reduce Motion setting', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render(<Probe />);
  expect(await screen.findByText('none')).toBeTruthy();
});

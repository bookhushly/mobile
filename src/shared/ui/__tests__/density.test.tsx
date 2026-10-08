import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { density } from '@/shared/theme';
import { DensityProvider, useDensity } from '@/shared/ui/DensityProvider';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';

function Probe() {
  const d = useDensity();
  return <Text>{String(d.controlHeight)}</Text>;
}

it('defaults to customer density without a provider', async () => {
  await render(<Probe />);
  expect(screen.getByText(String(density.customer.controlHeight))).toBeTruthy();
});

it('gate provider gives 64 pt controls', async () => {
  await render(
    <DensityProvider density="gate">
      <Probe />
    </DensityProvider>,
  );
  expect(screen.getByText('64')).toBeTruthy();
});

it('segmented control tabs take the density minimum target (48 at gate)', async () => {
  await render(
    <DensityProvider density="gate">
      <SegmentedControl
        value="a"
        onChange={jest.fn()}
        options={[
          { value: 'a', label: 'Not in' },
          { value: 'b', label: 'In' },
        ]}
      />
    </DensityProvider>,
  );
  const tab = screen.getByRole('tab', { name: 'Not in' });
  expect(StyleSheet.flatten(tab.props.style as StyleProp<ViewStyle>).minHeight).toBe(
    density.gate.minTarget,
  );
});

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { density } from '@/shared/theme';
import { DensityProvider, useDensity } from '@/shared/ui/DensityProvider';

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

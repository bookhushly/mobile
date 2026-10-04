import { render, screen } from '@testing-library/react-native';

import { Text } from '@/shared/ui';

it('renders text with tabular numerals when requested', async () => {
  await render(
    <Text tabular testID="t">
      ₦1,000
    </Text>,
  );
  const node = screen.getByTestId('t');
  expect(node.props.style).toEqual(expect.arrayContaining([{ fontVariant: ['tabular-nums'] }]));
  expect(node.props.maxFontSizeMultiplier).toBe(1.6);
});

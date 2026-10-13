import { render, screen } from '@testing-library/react-native';

import { color } from '@/shared/theme';
import { DateTile } from '@/shared/ui';

it('shows month, day and weekday', async () => {
  await render(<DateTile tile={{ month: 'Oct', day: '18', weekday: 'Sun' }} />);
  expect(screen.getByText('Oct')).toBeTruthy();
  expect(screen.getByText('18')).toBeTruthy();
  expect(screen.getByText('Sun')).toBeTruthy();
});

it('says TBC when the date is not known', async () => {
  await render(<DateTile tile={null} />);
  expect(screen.getByText('TBC')).toBeTruthy();
});

it('never scales its three lines (fixed 56 pt tile), month in ink not violet', async () => {
  await render(<DateTile tile={{ month: 'Oct', day: '18', weekday: 'Sun' }} />);
  for (const t of ['Oct', '18', 'Sun'])
    expect(screen.getByText(t).props.maxFontSizeMultiplier).toBe(1);
  expect(screen.getByText('Oct')).toHaveStyle({ color: color.textPrimary });
});

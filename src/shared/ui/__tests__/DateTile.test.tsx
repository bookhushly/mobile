import { render, screen } from '@testing-library/react-native';

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

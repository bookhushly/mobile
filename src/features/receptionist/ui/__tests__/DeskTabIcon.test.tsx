import { render, screen } from '@testing-library/react-native';
import { Users } from 'lucide-react-native';

import { DeskTabIcon } from '@/features/receptionist/ui/DeskTabIcon';
import { color } from '@/shared/theme';

it('shows the bar only on the active tab, in the 7:1 violet', async () => {
  const view = await render(<DeskTabIcon icon={Users} focused tint="#000" size={24} />);
  expect(screen.getByTestId('tab-indicator')).toHaveStyle({ backgroundColor: color.actionPressed });
  await view.rerender(<DeskTabIcon icon={Users} focused={false} tint="#000" size={24} />);
  expect(screen.queryByTestId('tab-indicator')).toBeNull();
});

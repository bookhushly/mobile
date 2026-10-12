import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import DeskTabsLayout from '@/app/(receptionist)/(tabs)/_layout';
import { color, layout } from '@/shared/theme';
import { useWide } from '@/shared/ui/useWide';

type Options = {
  tabBarPosition?: string;
  tabBarActiveTintColor?: string;
  tabBarActiveBackgroundColor?: string;
  tabBarStyle?: Record<string, unknown>;
};
const mockTabs: { options: Options | null } = { options: null };
jest.mock('expo-router', () => {
  const Tabs = ({ screenOptions, children }: { screenOptions: Options; children: ReactNode }) => {
    mockTabs.options = screenOptions;
    return children;
  };
  Tabs.Screen = function TabsScreen() {
    return null;
  };
  return { Tabs };
});
jest.mock('@/shared/ui/useWide', () => ({ useWide: jest.fn() }));

beforeEach(() => {
  mockTabs.options = null;
});

it('marks the active tab with a selected wash as well as the tint (bottom bar)', async () => {
  jest.mocked(useWide).mockReturnValue(false);
  await render(<DeskTabsLayout />);
  expect(mockTabs.options).toMatchObject({
    tabBarPosition: 'bottom',
    tabBarActiveTintColor: color.linkText,
    tabBarActiveBackgroundColor: color.selectedWash,
  });
  expect(mockTabs.options?.tabBarStyle?.width).toBeUndefined();
});

it('uses the same cue on the tablet rail, whose width is pinned', async () => {
  jest.mocked(useWide).mockReturnValue(true);
  await render(<DeskTabsLayout />);
  expect(mockTabs.options).toMatchObject({
    tabBarPosition: 'left',
    tabBarActiveBackgroundColor: color.selectedWash,
    tabBarStyle: { width: layout.tabletRailWidth, minWidth: layout.tabletRailWidth },
  });
});

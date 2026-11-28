import { Tabs } from 'expo-router';
import { BedDouble, CalendarDays, Users } from 'lucide-react-native';

import { color, layout, typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';
import { DeskTabIcon } from '@/features/receptionist/ui/DeskTabIcon';
import { useDensity, useTabBarPad, useWide } from '@/shared/ui';

const label = typeVariants.labelSm;

// R12: Today · Guests · Rooms. Tablets get a left rail; phones a bottom bar.
export default function DeskTabsLayout() {
  const wide = useWide();
  const d = useDensity();
  // The bottom bar only: a tablet's left rail must not take the extra height.
  const tabBarPad = useTabBarPad(label.maxScale);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        // Violet 700 rather than the fill: a small label needs the 7:1 shade. The non-colour cue
        // (WCAG 1.4.1) is the bar above the icon (DeskTabIcon), not a wash behind the tab.
        tabBarActiveTintColor: color.actionPressed,
        tabBarInactiveTintColor: color.textSecondary,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          borderRightColor: color.border,
          // Pinned so screens can size from the window (Rooms grid) without measuring.
          ...(wide ? { width: layout.tabletRailWidth, minWidth: layout.tabletRailWidth } : null),
          ...(wide ? null : tabBarPad),
        },
        tabBarItemStyle: { minHeight: d.controlHeight },
        tabBarLabelStyle: {
          fontFamily: fontFamily(label.font, label.weight),
          fontSize: label.size,
          letterSpacing: label.letterSpacing,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused, color: tint, size }) => (
            <DeskTabIcon icon={CalendarDays} focused={focused} tint={tint} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="guests"
        options={{
          title: 'Guests',
          tabBarIcon: ({ focused, color: tint, size }) => (
            <DeskTabIcon icon={Users} focused={focused} tint={tint} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          tabBarIcon: ({ focused, color: tint, size }) => (
            <DeskTabIcon icon={BedDouble} focused={focused} tint={tint} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

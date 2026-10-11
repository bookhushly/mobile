import { Tabs } from 'expo-router';
import { BedDouble, LayoutDashboard, Users } from 'lucide-react-native';

import { color, typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';
import { useDensity, useWide } from '@/shared/ui';

const label = typeVariants.labelSm;

// R12: Today · Guests · Rooms. Tablets get a left rail; phones a bottom bar.
export default function DeskTabsLayout() {
  const wide = useWide();
  const d = useDensity();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        // linkText (violet 700) rather than the fill: a 12 px label needs the 7:1 shade.
        tabBarActiveTintColor: color.linkText,
        tabBarInactiveTintColor: color.textSecondary,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          borderRightColor: color.border,
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
          tabBarIcon: ({ color: tint, size }) => <LayoutDashboard color={tint} size={size} />,
        }}
      />
      <Tabs.Screen
        name="guests"
        options={{
          title: 'Guests',
          tabBarIcon: ({ color: tint, size }) => <Users color={tint} size={size} />,
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          tabBarIcon: ({ color: tint, size }) => <BedDouble color={tint} size={size} />,
        }}
      />
    </Tabs>
  );
}

import { Tabs } from 'expo-router';
import { Ticket, UserRound } from 'lucide-react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTourSeen } from '@/features/customer/hooks/useTourSeen';
import { TourScreen } from '@/features/customer/screens/TourScreen';
import { CUSTOMER_TOUR_ENABLED } from '@/shared/config/features';
import { color } from '@/shared/theme';
import { Text, useDensity } from '@/shared/ui';

const LABEL_MAX_SCALE = 1.3;

// C2: Bookings · Account (Explore and Saved join in 4b). A bottom bar on every size.
export default function CustomerTabsLayout() {
  const d = useDensity();
  const state = useAuth((s) => s.state);
  const userId = state.status === 'signedIn' ? state.userId : null;
  // C15: switched off until 4b, and then no keychain read for the tour marker at all.
  const { seen, markSeen } = useTourSeen(CUSTOMER_TOUR_ENABLED ? userId : null);
  // Only a resolved "not seen" shows the tour: null (still reading) falls through to the tabs.
  if (CUSTOMER_TOUR_ENABLED && seen === false) return <TourScreen onDone={markSeen} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'bottom',
        // linkText (violet 700) rather than the fill: a 12 px label needs the 7:1 shade.
        tabBarActiveTintColor: color.linkText,
        tabBarInactiveTintColor: color.textSecondary,
        // A non-colour cue for the active tab (WCAG 1.4.1): a selected wash behind it.
        tabBarActiveBackgroundColor: color.selectedWash,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
        tabBarItemStyle: { minHeight: d.controlHeight },
        // Labels follow Dynamic Type up to 1.3× so the fixed-height bar never clips (ruling B6).
        tabBarLabel: ({ color: tint, children }) => (
          <Text
            variant="labelSm"
            maxScale={LABEL_MAX_SCALE}
            numberOfLines={1}
            style={{ color: tint }}
          >
            {children}
          </Text>
        ),
      }}
    >
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color: tint, size }) => <Ticket color={tint} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color: tint, size }) => <UserRound color={tint} size={size} />,
        }}
      />
    </Tabs>
  );
}

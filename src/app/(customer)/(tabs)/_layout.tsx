import { Tabs } from 'expo-router';
import { Compass, Heart, Ticket, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTourSeen } from '@/features/customer/hooks/useTourSeen';
import { TourScreen } from '@/features/customer/screens/TourScreen';
import { useKnownCustomer } from '@/features/mode/hooks/useKnownCustomer';
import { CUSTOMER_TOUR_ENABLED } from '@/shared/config/features';
import { color } from '@/shared/theme';
import { Text, useDensity } from '@/shared/ui';

const LABEL_MAX_SCALE = 1.3;

// Spec 4b D1: Explore · Saved · Bookings · Account. A bottom bar on every size.
export default function CustomerTabsLayout() {
  const d = useDensity();
  const state = useAuth((s) => s.state);
  const recovery = useAuth((s) => s.recovery);
  // No tour during a mode lookup: the account signing in may yet be staff.
  const { customerId } = useKnownCustomer(
    state.status === 'signedIn' ? state.userId : null,
    recovery,
  );
  const userId = customerId === '' ? null : customerId;
  // D15: the tour is on (switched off, the tour marker is never read from the keychain).
  const { seen, markSeen } = useTourSeen(CUSTOMER_TOUR_ENABLED ? userId : null);
  const holding = CUSTOMER_TOUR_ENABLED && userId !== null && seen === null;
  const touring = CUSTOMER_TOUR_ENABLED && seen === false;
  // Once up, the tabs are never replaced: signing in from Saved has to come back to Saved.
  const [tabsUp, setTabsUp] = useState(false);
  if (!tabsUp && !holding && !touring) setTabsUp(true);
  if (!tabsUp) {
    // Final review F2: while the marker is still being read (a keychain read, a few ms), a plain
    // view rather than the tabs, so Explore never mounts, starts its loads, and unmounts for the
    // tour. A failed read resolves as seen, so this never sticks.
    if (holding)
      return <View testID="tour-gate-pending" style={{ flex: 1, backgroundColor: color.canvas }} />;
    if (touring) return <TourScreen onDone={markSeen} />;
  }
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={touring}
        importantForAccessibility={touring ? 'no-hide-descendants' : 'auto'}
      >
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
            name="explore"
            options={{
              title: 'Explore',
              tabBarIcon: ({ color: tint, size }) => <Compass color={tint} size={size} />,
            }}
          />
          <Tabs.Screen
            name="saved"
            options={{
              title: 'Saved',
              tabBarIcon: ({ color: tint, size }) => <Heart color={tint} size={size} />,
            }}
          />
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
      </View>
      {touring ? (
        <View testID="tour-overlay" accessibilityViewIsModal style={StyleSheet.absoluteFill}>
          <TourScreen onDone={markSeen} />
        </View>
      ) : null}
    </View>
  );
}

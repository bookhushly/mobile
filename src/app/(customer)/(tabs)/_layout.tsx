import { Tabs } from 'expo-router';
import { Compass, Heart, Ticket, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useNotificationPrimer } from '@/features/customer/hooks/useNotificationPrimer';
import { useTourSeen } from '@/features/customer/hooks/useTourSeen';
import { NotificationPrimerScreen } from '@/features/customer/screens/NotificationPrimerScreen';
import { TourScreen } from '@/features/customer/screens/TourScreen';
import { useKnownCustomer } from '@/features/mode/hooks/useKnownCustomer';
import { CUSTOMER_TOUR_ENABLED } from '@/shared/config/features';
import { borderWidth, color } from '@/shared/theme';
import { Text, useDensity, useTabBarPad } from '@/shared/ui';

const LABEL_MAX_SCALE = 1.3;
// The active icon draws a touch heavier, so the state reads without colour.
const STROKE_ON = 2.25;
const STROKE_OFF = 1.75;

// Spec 4b D1: Explore · Saved · Bookings · Account. A bottom bar on every size.
export default function CustomerTabsLayout() {
  const d = useDensity();
  const tabBarPad = useTabBarPad(LABEL_MAX_SCALE);
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
  // After the tour, once per device: the notifications primer (customers only, never browsing).
  const primer = useNotificationPrimer({
    customer: userId !== null,
    tourDone: !CUSTOMER_TOUR_ENABLED || seen === true,
  });
  const covered = touring || primer.open;
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
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
      >
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarPosition: 'bottom',
            // Expedia and Airbnb: the active tab in the brand colour, the rest quiet grey, no block
            // behind it. Violet 700 (7.1:1) for the 13 pt label. The non-colour cue (WCAG 1.4.1) is
            // the heavier label and icon stroke below.
            tabBarActiveTintColor: color.actionPressed,
            tabBarInactiveTintColor: color.textMuted,
            tabBarStyle: {
              backgroundColor: color.surface,
              borderTopColor: color.border,
              borderTopWidth: borderWidth.hairline,
              ...tabBarPad,
            },
            tabBarItemStyle: { minHeight: d.controlHeight },
            // Labels follow Dynamic Type up to 1.3× so the fixed-height bar never clips (ruling B6).
            tabBarLabel: ({ color: tint, focused, children }) => (
              <Text
                variant={focused ? 'labelSm' : 'caption'}
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
              tabBarIcon: ({ color: tint, size, focused }) => (
                <Compass color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
              ),
            }}
          />
          <Tabs.Screen
            name="saved"
            options={{
              title: 'Saved',
              tabBarIcon: ({ color: tint, size, focused }) => (
                <Heart color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
              ),
            }}
          />
          <Tabs.Screen
            name="bookings"
            options={{
              title: 'Bookings',
              tabBarIcon: ({ color: tint, size, focused }) => (
                <Ticket color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
              ),
            }}
          />
          <Tabs.Screen
            name="account"
            options={{
              title: 'Account',
              tabBarIcon: ({ color: tint, size, focused }) => (
                <UserRound
                  color={tint}
                  size={size}
                  strokeWidth={focused ? STROKE_ON : STROKE_OFF}
                />
              ),
            }}
          />
        </Tabs>
      </View>
      {touring ? (
        <View testID="tour-overlay" accessibilityViewIsModal style={StyleSheet.absoluteFill}>
          <TourScreen onDone={markSeen} />
        </View>
      ) : primer.open ? (
        <View testID="primer-overlay" accessibilityViewIsModal style={StyleSheet.absoluteFill}>
          <NotificationPrimerScreen
            onTurnOn={() => {
              void primer.accept();
            }}
            onNotNow={primer.dismiss}
          />
        </View>
      ) : null}
    </View>
  );
}

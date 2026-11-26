import { Tabs } from 'expo-router';
import {
  BedDouble,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  Inbox,
  ScanLine,
  Sun,
  Ticket,
  UserRound,
  Wallet,
} from 'lucide-react-native';

import { vendorTabs } from '@/features/vendor/domain/vendorTabs';
import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { borderWidth, color } from '@/shared/theme';
import { Text, useDensity } from '@/shared/ui';

const LABEL_MAX_SCALE = 1.3;
// The active icon draws a touch heavier, so the state reads without colour.
const STROKE_ON = 2.25;
const STROKE_OFF = 1.75;

// Five tabs per kind of business (vendorTabs); the others stay declared but hidden.
export default function VendorTabsLayout() {
  const d = useDensity();
  const { vendor } = useVendorSession();
  const shown = new Set<string>(vendorTabs(vendor.kind));
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'bottom',
        // As the customer tabs: violet 700 for the active label and icon, quiet grey for the rest.
        tabBarActiveTintColor: color.actionPressed,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          borderTopWidth: borderWidth.hairline,
        },
        tabBarItemStyle: { minHeight: d.controlHeight },
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
        name="today"
        options={{
          title: 'Today',
          href: shown.has('today') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <Sun color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          href: shown.has('requests') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <Inbox color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          href: shown.has('jobs') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <BriefcaseBusiness
              color={tint}
              size={size}
              strokeWidth={focused ? STROKE_ON : STROKE_OFF}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          href: shown.has('bookings') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <CalendarDays color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
          ),
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          href: shown.has('rooms') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <BedDouble color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          href: shown.has('calendar') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <CalendarRange
              color={tint}
              size={size}
              strokeWidth={focused ? STROKE_ON : STROKE_OFF}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          href: shown.has('events') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <Ticket color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: shown.has('scan') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <ScanLine color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          href: shown.has('earnings') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <Wallet color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          href: shown.has('account') ? undefined : null,
          tabBarIcon: ({ color: tint, size, focused }) => (
            <UserRound color={tint} size={size} strokeWidth={focused ? STROKE_ON : STROKE_OFF} />
          ),
        }}
      />
    </Tabs>
  );
}

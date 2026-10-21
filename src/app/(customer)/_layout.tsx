import { Stack } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCustomerSession } from '@/features/customer/hooks/useCustomerSession';
import { useResumePayments } from '@/features/customer/hooks/useResumePayments';
import { DensityProvider } from '@/shared/ui/DensityProvider';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function CustomerLayout() {
  // Leaving customer mode drops the cached bookings, tickets and profile from memory.
  useCustomerSession();
  // Spec P5: payments left open when the app was killed are settled quietly, once per mount and
  // on each return to the foreground. Its import also registers the checkout store's sign-out wipe.
  const state = useAuth((s) => s.state);
  useResumePayments(state.status === 'signedIn' ? state.userId : '');
  return (
    <DensityProvider density="customer">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* Spec P22: checkout's Select step, a plain stack screen over the tabs. */}
        <Stack.Screen name="checkout/[kind]/[listingId]" />
        {/* P22: Review → Checking → Done. No swipe back: leaving runs through beforeRemove. */}
        <Stack.Screen name="pay/[kind]/[bookingId]" options={{ gestureEnabled: false }} />
        {/* C10/C11: codes are shown on a bare full-screen sheet, nothing else on screen. */}
        <Stack.Screen name="tickets/[bookingId]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="check-in-code/[bookingId]"
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack>
    </DensityProvider>
  );
}

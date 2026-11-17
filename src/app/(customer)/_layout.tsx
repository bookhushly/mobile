import { router, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useCustomerSession } from '@/features/customer/hooks/useCustomerSession';
import { useResumePayments } from '@/features/customer/hooks/useResumePayments';
import { PendingSaveNotice } from '@/features/customer/ui/PendingSaveNotice';
import { SignInPromptSheet } from '@/features/customer/ui/SignInPromptSheet';
import { useKnownCustomer } from '@/features/mode/hooks/useKnownCustomer';
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
  const recovery = useAuth((s) => s.recovery);
  const signOut = useSignOut();
  const { customerId } = useKnownCustomer(
    state.status === 'signedIn' ? state.userId : null,
    recovery,
  );
  return (
    <DensityProvider density="customer">
      <SignInPromptSheet
        onCreateAccount={() => {
          router.push('/sign-up');
        }}
        onSignIn={() => {
          router.push('/sign-in');
        }}
      />
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
      {/* After the stack, so it draws on top. */}
      <PendingSaveNotice
        userId={customerId}
        onSignInAgain={() => {
          signOut();
        }}
      />
    </DensityProvider>
  );
}

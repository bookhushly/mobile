import { router, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCompletePendingSave } from '@/features/customer/hooks/useCompletePendingSave';
import { useCustomerSession } from '@/features/customer/hooks/useCustomerSession';
import { useResumePayments } from '@/features/customer/hooks/useResumePayments';
import { SignInPromptSheet } from '@/features/customer/ui/SignInPromptSheet';
import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';
import { DensityProvider } from '@/shared/ui/DensityProvider';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export const unstable_settings = { initialRouteName: '(tabs)' };

// A leaf, because useSaved re-renders on every heart and the whole stack shouldn't.
function PendingSave({ userId }: { userId: string }) {
  useCompletePendingSave(userId);
  return null;
}

export default function CustomerLayout() {
  // Leaving customer mode drops the cached bookings, tickets and profile from memory.
  useCustomerSession();
  // Spec P5: payments left open when the app was killed are settled quietly, once per mount and
  // on each return to the foreground. Its import also registers the checkout store's sign-out wipe.
  const state = useAuth((s) => s.state);
  useResumePayments(state.status === 'signedIn' ? state.userId : '');
  // Customer is held while a browsing person's mode loads, and that account may yet be staff.
  // Browsing ends once the mode has settled, so only then is this known to be a customer.
  const recovery = useAuth((s) => s.recovery);
  const browsing = useBrowseChoice((s) => s.browsing);
  const customerId =
    state.status === 'signedIn' && !recovery && browsing !== true ? state.userId : '';
  return (
    <DensityProvider density="customer">
      <PendingSave userId={customerId} />
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
    </DensityProvider>
  );
}

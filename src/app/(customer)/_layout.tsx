import { Stack } from 'expo-router';

import { useCustomerSession } from '@/features/customer/hooks/useCustomerSession';
import { DensityProvider } from '@/shared/ui/DensityProvider';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function CustomerLayout() {
  // Leaving customer mode drops the cached bookings, tickets and profile from memory.
  useCustomerSession();
  return (
    <DensityProvider density="customer">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
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

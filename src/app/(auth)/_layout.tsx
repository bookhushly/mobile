import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthBackdrop } from '@/features/auth/components/AuthBackdrop';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { DensityProvider } from '@/shared/ui/DensityProvider';

// Screens draw over the shared photo: no native animation, and nothing opaque in the stack.
const transparent = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent' },
};

export default function AuthLayout() {
  // Closing these screens still signed out means backing out, so a save asked for is forgotten.
  useEffect(
    () => () => {
      if (useAuth.getState().state.status === 'signedOut') {
        useSignInPrompt.getState().clearPending();
      }
    },
    [],
  );
  return (
    <DensityProvider density="customer">
      <AuthBackdrop />
      <StatusBar style="light" />
      <ThemeProvider value={transparent}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </ThemeProvider>
    </DensityProvider>
  );
}
export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

import { Stack } from 'expo-router';

import { DensityProvider } from '@/shared/ui/DensityProvider';

export default function AuthLayout() {
  return (
    <DensityProvider density="customer">
      <Stack screenOptions={{ headerShown: false }} />
    </DensityProvider>
  );
}
export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

import { Stack } from 'expo-router';

import { DensityProvider } from '@/shared/ui/DensityProvider';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export default function ModeLayout() {
  return (
    <DensityProvider density="customer">
      <Stack screenOptions={{ headerShown: false }} />
    </DensityProvider>
  );
}

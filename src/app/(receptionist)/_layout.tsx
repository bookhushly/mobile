import { Stack } from 'expo-router';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export default function ModeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

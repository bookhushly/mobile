import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

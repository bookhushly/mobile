import { Redirect } from 'expo-router';

import { ROUTE_HREF, useRouteStore } from '@/features/mode/hooks/useRouteStore';
import { LoadingScreen } from '@/features/mode/screens/LoadingScreen';

// Always mounted; sends the user to whichever guarded group the root layout resolved.
export default function Index() {
  const route = useRouteStore((s) => s.route);
  if (route === 'loading') return <LoadingScreen />;
  return <Redirect href={ROUTE_HREF[route]} />;
}

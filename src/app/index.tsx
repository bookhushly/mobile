import { Redirect } from 'expo-router';

import { ROUTE_HREF, useRouteStore } from '@/features/mode/hooks/useRouteStore';

// Always mounted; sends the user to whichever guarded group the root layout resolved.
export default function Index() {
  const route = useRouteStore((s) => s.route);
  if (route === 'loading') return null;
  return <Redirect href={ROUTE_HREF[route]} />;
}

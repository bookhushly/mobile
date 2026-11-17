import { Redirect } from 'expo-router';

import { ROUTE_HREF, useRouteStore } from '@/features/mode/hooks/useRouteStore';
import { LoadingScreen } from '@/features/mode/screens/LoadingScreen';

// Always mounted; sends the user to whichever guarded group the root layout resolved.
export default function Index() {
  const route = useRouteStore((s) => s.route);
  // One tree in both states, so the loading view is never remounted in the frame the route
  // settles (perf review): it stays up, without its progress line, while the redirect lands; a
  // bare Redirect drew nothing and the stack's grey showed between the splash and the next screen.
  return (
    <>
      <LoadingScreen progress={route === 'loading'} />
      {route === 'loading' ? null : <Redirect href={ROUTE_HREF[route]} />}
    </>
  );
}

import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { listingRefParams } from '@/features/customer/domain/routeParams';
import { ListingNotFound } from '@/features/customer/screens/ListingNotFound';
import { ListingScreen } from '@/features/customer/screens/ListingScreen';

const back = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/explore');
};

// Anything but a listing kind and a UUID is "isn't available right now", without a query.
export default function ListingRoute() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const listing = listingRefParams(params.kind, params.id);
  if (listing === null) return <ListingNotFound onBack={back} />;
  return (
    <ListingScreen
      // A new listing starts fresh (open sheets, the photo index).
      key={`${listing.kind}:${listing.id}`}
      kind={listing.kind}
      id={listing.id}
      userId={state.status === 'signedIn' ? state.userId : ''}
      onBack={back}
      onSignInAgain={() => {
        signOut();
      }}
    />
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';

import { listingRefParams } from '@/features/customer/domain/routeParams';
import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

// Placeholder until the listing screen lands (Phase 4b Task 7). Anything but a listing kind and a
// UUID is "isn't available right now", without a query.
export default function ListingRoute() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const listing = listingRefParams(params.kind, params.id);
  return (
    <NoticeScreen
      title="Listing"
      icon={SearchX}
      heading={
        listing === null ? 'This listing isn’t available right now' : 'Details are on their way'
      }
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/explore');
      }}
    />
  );
}

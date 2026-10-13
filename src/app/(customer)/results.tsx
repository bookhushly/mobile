import { router, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';

import { resultsParams } from '@/features/customer/domain/routeParams';
import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';

const TITLE = { hotels: 'Hotels', serviced_apartments: 'Apartments', events: 'Events' } as const;

// Placeholder until the Results screen lands (Phase 4b Task 6). Params are untrusted: parsed and
// sanitised before anything reads them.
export default function ResultsRoute() {
  const raw = useLocalSearchParams<{
    category?: string;
    q?: string;
    region?: string;
    city?: string;
  }>();
  const query = resultsParams(raw);
  return (
    <NoticeScreen
      title={TITLE[query.category]}
      icon={Search}
      heading="Results are on their way"
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/explore');
      }}
    />
  );
}

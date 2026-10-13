import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { resultsParams } from '@/features/customer/domain/routeParams';
import { ResultsScreen } from '@/features/customer/screens/ResultsScreen';

// Params are untrusted: parsed and sanitised before anything reads them.
export default function ResultsRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const raw = useLocalSearchParams<{
    category?: string;
    q?: string;
    region?: string;
    city?: string;
  }>();
  const userId = state.status === 'signedIn' ? state.userId : '';
  const query = resultsParams(raw);
  return (
    <ResultsScreen
      // A new search starts with no filters.
      key={`${query.category}|${query.q}|${query.state ?? ''}|${query.city ?? ''}`}
      userId={userId}
      query={query}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/explore');
      }}
      onOpenListing={(kind, id) => {
        router.push({ pathname: '/listing/[kind]/[id]', params: { kind, id } });
      }}
      onSignInAgain={() => {
        signOut();
      }}
    />
  );
}

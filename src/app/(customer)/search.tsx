import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { searchParams } from '@/features/customer/domain/routeParams';
import { SearchScreen } from '@/features/customer/screens/SearchScreen';

export default function SearchRoute() {
  const state = useAuth((s) => s.state);
  // Untrusted: parsed and sanitised before anything reads them.
  const params = searchParams(useLocalSearchParams<{ category?: string; q?: string }>());
  const userId = state.status === 'signedIn' ? state.userId : '';
  return (
    <SearchScreen
      userId={userId}
      initialCategory={params.category ?? 'hotels'}
      initialText={params.q}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/explore');
      }}
      onSearch={(t) => {
        router.push({ pathname: '/results', params: t });
      }}
    />
  );
}

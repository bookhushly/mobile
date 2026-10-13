import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { categoryParam } from '@/features/customer/domain/routeParams';
import { SearchScreen } from '@/features/customer/screens/SearchScreen';

export default function SearchRoute() {
  const state = useAuth((s) => s.state);
  const { category } = useLocalSearchParams<{ category?: string }>();
  const userId = state.status === 'signedIn' ? state.userId : '';
  return (
    <SearchScreen
      userId={userId}
      initialCategory={categoryParam(category) ?? 'hotels'}
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

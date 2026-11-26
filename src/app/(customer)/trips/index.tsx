import { router } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTrips } from '@/features/customer/hooks/useTrips';
import { TripsScreen } from '@/features/customer/screens/TripsScreen';
import { SignedOutTrips } from '@/features/customer/ui/trips/SignedOutTrips';

const back = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/bookings');
};

export default function TripsRoute() {
  const state = useAuth((s) => s.state);
  if (state.status !== 'signedIn') return <SignedOutTrips onBack={back} />;
  return <Trips userId={state.userId} />;
}

function Trips({ userId }: { userId: string }) {
  const q = useTrips(userId);
  const [refreshing, setRefreshing] = useState(false);
  return (
    <TripsScreen
      state={
        q.data !== undefined
          ? {
              status: 'ready',
              trips: q.data,
              refreshing,
              refresh: () => {
                setRefreshing(true);
                void q.refetch().finally(() => {
                  setRefreshing(false);
                });
              },
            }
          : q.isError
            ? { status: 'error', retry: () => void q.refetch() }
            : { status: 'loading' }
      }
      onBack={back}
      onOpen={(id) => {
        router.push({ pathname: '/trips/[id]', params: { id } });
      }}
      onPlan={() => {
        router.push('/trips/new');
      }}
    />
  );
}

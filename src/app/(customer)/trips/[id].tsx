import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTripScreen } from '@/features/customer/hooks/useTripScreen';
import { TripScreen } from '@/features/customer/screens/TripScreen';
import { SignedOutTrips } from '@/features/customer/ui/trips/SignedOutTrips';

const TRIP_ID = z.uuid();

const back = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/trips');
};

export default function TripRoute() {
  const state = useAuth((s) => s.state);
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (state.status !== 'signedIn') return <SignedOutTrips onBack={back} />;
  // Params are untrusted: anything but a trip id reads as "not found", never as a failed load.
  const tripId = typeof id === 'string' && TRIP_ID.safeParse(id).success ? id : '';
  return <Trip userId={state.userId} id={tripId} />;
}

function Trip({ userId, id }: { userId: string; id: string }) {
  const t = useTripScreen(userId, id);
  const q = t.q;
  return (
    <TripScreen
      state={
        id === ''
          ? { status: 'error', notFound: true, retry: () => undefined }
          : q.data !== undefined && q.data !== null
            ? { status: 'ready', trip: q.data, refreshing: t.refreshing, refresh: t.refresh }
            : q.data === null
              ? { status: 'error', notFound: true, retry: () => void q.refetch() }
              : q.isError
                ? { status: 'error', notFound: false, retry: () => void q.refetch() }
                : { status: 'loading' }
      }
      busy={t.busy}
      problem={t.problem}
      onBack={back}
      onBook={(s) => {
        if (q.data === undefined || q.data === null) return;
        const to = t.book(q.data, s);
        if (to.to === 'results')
          router.push({
            pathname: '/results',
            params: {
              category: to.category,
              ...(to.region === undefined ? {} : { region: to.region }),
            },
          });
        else router.push(`/${to.to}/new`);
      }}
      onAdd={(type) =>
        q.data === undefined || q.data === null ? Promise.resolve(false) : t.add(q.data, type)
      }
      onComplete={() => {
        void t.setStatus(id, 'completed');
      }}
      onArchive={async () => {
        const done = await t.setStatus(id, 'cancelled');
        if (done) back();
        return done;
      }}
    />
  );
}

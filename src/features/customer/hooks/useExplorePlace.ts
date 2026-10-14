import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { knownPlace, placeForState, type Place } from '@/features/customer/domain/discover';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { isSignedInAs } from '@/features/customer/hooks/sessionWrite';
import { useProfile } from '@/features/customer/hooks/useProfile';
import { plainKv } from '@/shared/platform/storage';

export const explorePlaceKey = (userId: string) => `bh.explore.place.${userId}`;

async function readPlace(userId: string): Promise<Place | null> {
  const raw = await plainKv.get(explorePlaceKey(userId));
  if (raw === null) return null;
  try {
    return knownPlace(JSON.parse(raw));
  } catch {
    return null;
  }
}

// Spec D6: the "Where to?" chip remembers the choice on this device. With none, the profile's
// state (users.state), else Lagos. `place` is null until that is known, and the default, once
// chosen, stays for the session (a profile that loads late never flips it), so the rails fetch once.
export function useExplorePlace(userId: string): {
  place: Place | null;
  setPlace: (p: Place) => void;
} {
  const qc = useQueryClient();
  const stored = useQuery({
    queryKey: customerKeys.explorePlace(userId),
    queryFn: () => readPlace(userId),
    networkMode: 'always',
    staleTime: Infinity,
  });
  const { profile, loading, error } = useProfile(userId);
  const setPlace = useCallback(
    (p: Place) => {
      qc.setQueryData<Place | null>(customerKeys.explorePlace(userId), p);
      // Best effort, and only for the account still signed in.
      void isSignedInAs(userId)
        .then((yes) => (yes ? plainKv.set(explorePlaceKey(userId), JSON.stringify(p)) : undefined))
        .catch(() => undefined);
    },
    [qc, userId],
  );
  const [chosen, setChosen] = useState<{ userId: string; place: Place } | null>(null);
  const storedDone = stored.data !== undefined || stored.isError;
  let place: Place | null = null;
  if (stored.data != null) place = stored.data;
  else if (chosen !== null && chosen.userId === userId) place = chosen.place;
  else if (storedDone) {
    const fallback =
      profile !== null
        ? placeForState(profile.state)
        : error || !loading
          ? placeForState(null)
          : null;
    if (fallback !== null) {
      // Latched (render-time update, as in loadState): later profile loads don't move the rails.
      setChosen({ userId, place: fallback });
      place = fallback;
    }
  }
  return { place, setPlace };
}

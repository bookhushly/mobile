import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { KIND_WORD } from '@/features/vendor/ui/kindWords';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';

// What every vendor container shares: who, the top of a Today, a query as a load state, links out.

export const SUPPORT_EMAIL = 'support@bookhushly.com';

export function useWho() {
  const { vendor } = useVendorSession();
  return { vendorId: vendor.id, kind: vendor.kind };
}

/** A query as the screens' load state, with pull-to-refresh. */
export function useLoad<T>(q: {
  isPending: boolean;
  isError: boolean;
  data: T | undefined;
  refetch: () => Promise<unknown>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  if (q.isPending || q.data === undefined)
    return q.isError
      ? ({ status: 'error', retry: () => void q.refetch() } as const)
      : ({ status: 'loading' } as const);
  return {
    status: 'ready' as const,
    data: q.data,
    refreshing,
    refresh: () => {
      setRefreshing(true);
      void q.refetch().finally(() => {
        setRefreshing(false);
      });
    },
  };
}

export function useTop() {
  const { vendor } = useVendorSession();
  const nowMs = clock.serverNow();
  return {
    businessName: vendor.name,
    kindWord: KIND_WORD[vendor.kind],
    today: lagosToday(nowMs),
    nowMs,
  };
}

/** Open a link the phone may not handle (no mail app on many iPads): say what to do instead. */
export function openOr(url: string, title: string, fallback: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert(title, fallback);
  });
}

export type TodayNav = {
  onOpenBookings: () => void;
  onOpenBooking: (id: string) => void;
  onOpenEvents: () => void;
};

import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';

import { TodayTop } from '@/features/vendor/ui/TodayTop';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { ErrorState, refreshColors, Screen, SkeletonRows } from '@/shared/ui';

export type Load<T> =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; data: T; refreshing: boolean; refresh: () => void };

export type Top = { businessName: string; kindWord: string; today: IsoDate; nowMs: number };

/** The frame every hotel, apartment and event Today shares: the top, loading and errors. */
export function ListingTodayFrame({
  top,
  lines,
  state,
  children,
}: {
  top: Top;
  lines: string[];
  state: Load<unknown>;
  children: ReactNode;
}) {
  return (
    <Screen
      scroll
      refreshControl={
        state.status === 'ready' ? (
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={state.refresh}
            {...refreshColors}
          />
        ) : undefined
      }
    >
      <View style={{ gap: space.s7, paddingTop: space.s5, paddingBottom: space.s8 }}>
        <TodayTop
          businessName={top.businessName}
          kindWord={top.kindWord}
          today={top.today}
          lines={lines}
        />
        {state.status === 'loading' ? (
          <SkeletonRows count={5} />
        ) : state.status === 'error' ? (
          <ErrorState
            title="We couldn’t load today"
            message="Check your connection and try again."
            onRetry={state.retry}
          />
        ) : (
          children
        )}
      </View>
    </Screen>
  );
}

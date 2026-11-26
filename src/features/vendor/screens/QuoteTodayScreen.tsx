import { RefreshControl, View } from 'react-native';

import {
  firstClosesLine,
  monthLabels,
  todayHeadline,
  upNext,
  type OpenRequest,
  type TodayJob,
  type VendorToday,
} from '@/features/vendor/domain/today';
import { MonthCard } from '@/features/vendor/ui/MonthCard';
import { NextJobCard } from '@/features/vendor/ui/NextJobCard';
import { RequestStrip } from '@/features/vendor/ui/RequestStrip';
import { SummaryRows } from '@/features/vendor/ui/SummaryRows';
import { lagosTime, longDate, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import {
  ErrorState,
  formatNaira,
  ListRow,
  refreshColors,
  Screen,
  SectionHeader,
  SkeletonRows,
  Text,
  TextLink,
} from '@/shared/ui';

export type QuoteTodayProps = {
  businessName: string;
  /** "Logistics", "Car rental", "Security". */
  kindWord: string;
  today: IsoDate;
  nowMs: number;
  state:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; data: VendorToday; refreshing: boolean; refresh: () => void };
  onOpenRequests: () => void;
  onOpenRequest: (r: OpenRequest) => void;
  onOpenJobs: () => void;
  onOpenJob: (j: TodayJob) => void;
  onOpenEarnings: () => void;
};

function Heading({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s4 }}>
      <Text variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      <TextLink label={action} onPress={onAction} />
    </View>
  );
}

/**
 * Today for car rental, logistics and security companies (design v13): who, the day in a line,
 * what needs you, the next job and its one action, new requests, then the month.
 */
export function QuoteTodayScreen(p: QuoteTodayProps) {
  const header = (
    <View style={{ gap: space.s1 }}>
      <Text variant="label">{p.businessName}</Text>
      <Text variant="caption" tone="textSecondary">
        {p.kindWord}
      </Text>
    </View>
  );

  if (p.state.status !== 'ready') {
    return (
      <Screen scroll>
        <View style={{ gap: space.s6, paddingTop: space.s5 }}>
          {header}
          {p.state.status === 'loading' ? (
            <SkeletonRows count={5} />
          ) : (
            <ErrorState
              title="We couldn’t load today"
              message="Check your connection and try again."
              onRetry={p.state.retry}
            />
          )}
        </View>
      </Screen>
    );
  }

  const { data, refreshing, refresh } = p.state;
  const { next, later } = upNext(data.jobs);
  const jobsToday = data.jobs.filter((j) => j.stage !== 'done').length;
  const lines = todayHeadline(jobsToday, data.requests.length);
  const labels = monthLabels(p.today);
  const gutter = space.s5;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />
      }
    >
      <View style={{ gap: space.s7, paddingTop: space.s5, paddingBottom: space.s8 }}>
        {header}
        <View style={{ gap: space.s2 }}>
          <Text variant="labelSm" tone="textSecondary">
            {longDate(p.today)}
          </Text>
          <Text variant="titleLg" accessibilityRole="header" testID="vendor-headline">
            {lines.join('\n')}
          </Text>
        </View>

        <SummaryRows
          rows={[
            {
              label: 'New requests',
              detail: firstClosesLine(
                data.requests.map((r) => r.closesAt),
                p.nowMs,
              ),
              value: String(data.requests.length),
              onPress: p.onOpenRequests,
              testID: 'vendor-row-requests',
            },
            {
              label: 'To withdraw',
              detail: data.wallet.held > 0 ? `${formatNaira(data.wallet.held)} on hold` : '',
              value: formatNaira(data.wallet.available),
              onPress: p.onOpenEarnings,
              testID: 'vendor-row-withdraw',
            },
          ]}
        />

        {next === null ? null : (
          <View style={{ gap: space.s4 }}>
            <Heading title="Up next" action="All jobs" onAction={p.onOpenJobs} />
            <NextJobCard
              job={next}
              nowMs={p.nowMs}
              onOpen={() => {
                p.onOpenJob(next);
              }}
            />
          </View>
        )}

        {data.requests.length === 0 ? null : (
          <View style={{ gap: space.s4 }}>
            <Heading
              title="New requests"
              action={`See all ${String(data.requests.length)}`}
              onAction={p.onOpenRequests}
            />
            <RequestStrip
              requests={data.requests}
              nowMs={p.nowMs}
              onOpen={p.onOpenRequest}
              gutter={gutter}
            />
          </View>
        )}

        {later.length === 0 ? null : (
          <View>
            <SectionHeader label="Later today" />
            {later.map((j) => (
              <ListRow
                key={j.id}
                title={j.title}
                subtitle={`${lagosTime(j.startsAt)} · ${j.to === null ? j.from : `${j.from} → ${j.to}`}`}
                accessibilityLabel={`${j.title}, at ${lagosTime(j.startsAt)}, ${j.to === null ? j.from : `from ${j.from} to ${j.to}`}`}
                onPress={() => {
                  p.onOpenJob(j);
                }}
              />
            ))}
          </View>
        )}

        <View style={{ gap: space.s4 }}>
          <Heading title="This month" action="Earnings" onAction={p.onOpenEarnings} />
          <MonthCard
            now={data.month.now}
            then={data.month.then}
            daysInMonth={data.month.daysInMonth}
            thisMonth={labels.thisMonth}
            lastMonth={labels.lastMonth}
          />
        </View>
      </View>
    </Screen>
  );
}

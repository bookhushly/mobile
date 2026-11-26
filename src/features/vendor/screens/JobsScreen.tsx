import { BriefcaseBusiness, ChevronRight } from 'lucide-react-native';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';

import {
  groupByDay,
  jobHeadline,
  jobStage,
  splitJobs,
  type JobTab,
  type VendorJob,
} from '@/features/vendor/domain/jobs';
import { lagosTime } from '@/shared/lib/lagosDay';
import { borderWidth, color, pressedOpacity, radius, space, vendorSize } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  Icon,
  refreshColors,
  Screen,
  SegmentedControl,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  nowMs: number;
  tab: JobTab;
  onTab: (t: JobTab) => void;
  state:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; jobs: VendorJob[]; refreshing: boolean; refresh: () => void };
  onOpen: (j: VendorJob) => void;
};

const EMPTY: Record<JobTab, { title: string; message: string }> = {
  upcoming: {
    title: 'No jobs coming up',
    message: 'When a customer chooses your quote, the job shows here.',
  },
  running: {
    title: 'Nothing running',
    message: 'Jobs you’ve started show here until the customer confirms.',
  },
  done: {
    title: 'No finished jobs yet',
    message: 'Jobs show here once the customer confirms and you’re paid.',
  },
};

/** Your move (ink) or someone else's (grey): the quiet status line under each job. */
const yourMove = (j: VendorJob) => {
  const s = jobStage(j);
  return s === 'ready' || s === 'running';
};

function JobRow({ job: j, onPress }: { job: VendorJob; onPress: () => void }) {
  const time = lagosTime(j.startsAt);
  const where = j.to === null ? j.from : `${j.from} to ${j.to}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${j.title}, at ${time}, ${where}. ${jobHeadline(j)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        paddingVertical: space.s4,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
        opacity: pressed ? pressedOpacity : 1,
      })}
    >
      <View
        style={{
          minWidth: vendorSize.rowPhoto,
          paddingVertical: space.s3,
          paddingHorizontal: space.s2,
          borderRadius: radius.r3,
          backgroundColor: color.wash,
          alignItems: 'center',
        }}
      >
        <Text variant="label" tabular maxScale={1.3} numberOfLines={1}>
          {time}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space.s1 }}>
        <Text variant="label" numberOfLines={1}>
          {j.title}
        </Text>
        <Text variant="caption" tone="textSecondary" numberOfLines={1}>
          {j.to === null ? j.from : `${j.from} → ${j.to}`}
        </Text>
        <Text
          variant={yourMove(j) ? 'labelSm' : 'caption'}
          tone={yourMove(j) ? 'textPrimary' : 'textSecondary'}
          numberOfLines={1}
        >
          {jobHeadline(j)}
        </Text>
      </View>
      <Icon as={ChevronRight} size="sm" tone="textMuted" />
    </Pressable>
  );
}

/** Jobs (design v13): grouped by day, so the week reads at a glance. */
export function JobsScreen({ nowMs, tab, onTab, state, onOpen }: Props) {
  const split = state.status === 'ready' ? splitJobs(state.jobs) : null;
  const list = split?.[tab] ?? [];
  // Done jobs read newest first; the rest in the order they happen.
  const groups = groupByDay(list, nowMs);
  if (tab === 'done') groups.reverse();
  const header = (
    <View style={{ gap: space.s5, paddingBottom: space.s4 }}>
      <Text variant="titleLg" accessibilityRole="header">
        Jobs
      </Text>
      <SegmentedControl
        value={tab}
        onChange={onTab}
        testID="vendor-jobs-tabs"
        options={[
          {
            value: 'upcoming',
            label: 'Upcoming',
            ...(split ? { count: split.upcoming.length } : {}),
          },
          { value: 'running', label: 'Running', ...(split ? { count: split.running.length } : {}) },
          { value: 'done', label: 'Done' },
        ]}
      />
    </View>
  );
  // Done grows with every job ever finished (the route isn't paged): a list that draws only what's
  // on screen, one section per day.
  return (
    <Screen>
      <SectionList
        sections={
          state.status === 'ready'
            ? groups.map((g) => ({ key: g.day, title: g.label, data: g.jobs }))
            : []
        }
        style={{ flex: 1 }}
        keyExtractor={(j) => j.id}
        initialNumToRender={10}
        windowSize={7}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <Text
            variant="labelSm"
            tone="textSecondary"
            accessibilityRole="header"
            style={{ paddingTop: space.s4, backgroundColor: color.surface }}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <JobRow
            job={item}
            onPress={() => {
              onOpen(item);
            }}
          />
        )}
        ListEmptyComponent={
          state.status === 'loading' ? (
            <SkeletonRows count={4} />
          ) : state.status === 'error' ? (
            <ErrorState
              title="We couldn’t load your jobs"
              message="Check your connection and try again."
              onRetry={state.retry}
            />
          ) : (
            <EmptyState
              icon={BriefcaseBusiness}
              title={EMPTY[tab].title}
              message={EMPTY[tab].message}
            />
          )
        }
        refreshControl={
          state.status === 'ready' ? (
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={state.refresh}
              {...refreshColors}
            />
          ) : undefined
        }
      />
    </Screen>
  );
}

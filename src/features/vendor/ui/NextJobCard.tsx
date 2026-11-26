import { Clock } from 'lucide-react-native';
import { View } from 'react-native';

import { startsLabel, type TodayJob } from '@/features/vendor/domain/today';
import { Route } from '@/features/vendor/ui/Route';
import { ServicePhoto } from '@/features/vendor/ui/ServicePhoto';
import { TimePill } from '@/features/vendor/ui/TimePill';
import { borderWidth, color, radius, space, vendorSize } from '@/shared/theme';
import { Button, Money, Text } from '@/shared/ui';

type Props = { job: TodayJob; nowMs: number; onOpen: () => void };

const STAGE: Record<TodayJob['stage'], string> = {
  paid: 'Paid',
  inProgress: 'Running now',
  done: 'Done',
};

/** "Up next": the job as a photo card with its route, the customer, and its one action. */
export function NextJobCard({ job, nowMs, onOpen }: Props) {
  return (
    <View
      testID="vendor-next-job"
      style={{
        borderRadius: radius.r4,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        overflow: 'hidden',
        backgroundColor: color.surface,
      }}
    >
      <ServicePhoto photo={job.photo} height={vendorSize.jobPhoto}>
        <TimePill icon={Clock} label={startsLabel(job.startsAt, nowMs)} />
      </ServicePhoto>
      <View style={{ padding: space.s5, gap: space.s4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s3 }}>
          <Text variant="label" style={{ flex: 1 }}>
            {job.title}
          </Text>
          <Money amount={job.payout} variant="labelSm" />
        </View>
        <Route from={job.from} to={job.to} />
        <View style={{ gap: space.s1 }}>
          <Text variant="labelSm">{job.customerName}</Text>
          <Text variant="caption" tone="textSecondary">
            {STAGE[job.stage]}
          </Text>
        </View>
        <Button label="Open job" onPress={onOpen} testID="vendor-next-job-open" />
      </View>
    </View>
  );
}

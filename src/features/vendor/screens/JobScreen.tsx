import { ArrowLeft, Camera, Lock, Navigation } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  heldLine,
  jobHeadline,
  jobProgress,
  jobStage,
  nextStep,
  type NextStep,
  type VendorJob,
} from '@/features/vendor/domain/jobs';
import type { JobAction, JobProblem } from '@/features/vendor/hooks/useVendorJobs';
import { DeliveryPhotoSheet } from '@/features/vendor/ui/DeliveryPhotoSheet';
import { CustomerCard } from '@/features/vendor/ui/CustomerCard';
import { JobProgress } from '@/features/vendor/ui/JobProgress';
import { Route } from '@/features/vendor/ui/Route';
import { shortDate, lagosTime, lagosToday } from '@/shared/lib/lagosDay';
import { color, radius, space } from '@/shared/theme';
import {
  Banner,
  Button,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  state:
    | { status: 'loading' }
    | { status: 'error'; notFound: boolean; retry: () => void }
    | { status: 'ready'; job: VendorJob };
  busy: boolean;
  problem: JobProblem | null;
  onBack: () => void;
  onHelp: () => void;
  onCall: (phone: string) => void;
  onDirections: (address: string) => void;
  onAction: (a: JobAction) => void;
};

const STEP_LABEL: Record<string, string> = {
  start: 'Start job',
  picked_up: 'Mark picked up',
  in_transit: 'Mark on the way',
  delivered: 'Take a delivery photo',
  complete: 'Mark the job done',
};

const stepKey = (s: NextStep) => (s.kind === 'milestone' ? s.milestone : s.kind);

/** What's waiting on someone else, said under the headline when there's no step for the vendor. */
function waitingLine(j: VendorJob): string | null {
  switch (jobStage(j)) {
    case 'awaitingPayment':
      return 'The customer chose your quote. The job starts once they pay; you’ll get a notification.';
    case 'awaitingConfirm':
      return 'You’ve marked it done. The customer confirms, then you’re paid.';
    case 'disputed':
      return 'The customer reported a problem. Bookhushly support will contact you.';
    case 'ready':
    case 'running':
    case 'done':
      return null;
  }
}

/** One job (design v13): where it stands in large type, the customer, the route, the next step. */
export function JobScreen({
  state,
  busy,
  problem,
  onBack,
  onHelp,
  onCall,
  onDirections,
  onAction,
}: Props) {
  const [photo, setPhoto] = useState(false);
  const header = (
    <Header
      title=""
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
      right={<Button label="Help" variant="secondary" onPress={onHelp} />}
    />
  );
  if (state.status !== 'ready')
    return (
      <Screen header={header}>
        {state.status === 'loading' ? (
          <SkeletonRows count={5} />
        ) : (
          <ErrorState
            title={state.notFound ? 'This job isn’t available' : 'We couldn’t load this job'}
            message={
              state.notFound
                ? 'It may have been cancelled.'
                : 'Check your connection and try again.'
            }
            onRetry={state.notFound ? onBack : state.retry}
          />
        )}
      </Screen>
    );

  const j = state.job;
  const step = nextStep(j);
  const progress = jobProgress(j);
  const held = heldLine(j);
  const waiting = waitingLine(j);
  const day = lagosToday(Date.parse(j.startsAt));
  const destination = j.to ?? j.from;

  const run = () => {
    if (step === null || busy) return;
    if (step.kind === 'milestone' && step.milestone === 'delivered') {
      setPhoto(true);
      return;
    }
    onAction(
      step.kind === 'milestone'
        ? { kind: 'milestone', milestone: step.milestone, photoUri: null }
        : step,
    );
  };

  return (
    <Screen
      scroll
      header={header}
      footer={
        step === null && problem === null ? undefined : (
          <View style={{ gap: space.s3 }}>
            {problem === null ? null : (
              <Banner
                tone={problem.transient ? 'neutral' : 'warning'}
                title={problem.title}
                message={problem.message}
              />
            )}
            {step === null ? null : (
              <Button
                label={STEP_LABEL[stepKey(step)] ?? 'Continue'}
                icon={stepKey(step) === 'delivered' ? Camera : undefined}
                loading={busy}
                onPress={run}
                testID="vendor-job-step"
              />
            )}
          </View>
        )
      }
    >
      <View style={{ gap: space.s6, paddingBottom: space.s7 }}>
        <View style={{ gap: space.s2 }}>
          <Text variant="caption" tone="textSecondary">
            {`${j.title} · ${shortDate(day)}, ${lagosTime(j.startsAt)}`}
          </Text>
          <Text variant="display" accessibilityRole="header" testID="vendor-job-headline">
            {jobHeadline(j)}
          </Text>
          {waiting === null ? null : (
            <Text variant="bodySm" tone="textSecondary">
              {waiting}
            </Text>
          )}
        </View>

        <JobProgress steps={progress} />

        <CustomerCard name={j.customer.name} phone={j.customer.phone} onCall={onCall} />

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.s4 }}>
          <View style={{ flex: 1 }}>
            <Route from={j.from} to={j.to} />
          </View>
          <IconButton
            icon={Navigation}
            accessibilityLabel={`Directions to ${destination}`}
            onPress={() => {
              onDirections(destination);
            }}
          />
        </View>

        {held === null ? null : (
          <View
            style={{
              flexDirection: 'row',
              gap: space.s4,
              backgroundColor: color.wash,
              borderRadius: radius.r4,
              padding: space.s5,
            }}
          >
            <Icon as={Lock} size="sm" />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {held}
            </Text>
          </View>
        )}
        {step !== null && stepKey(step) === 'delivered' ? (
          <Text variant="caption" tone="textSecondary">
            The customer sees the photo when they confirm delivery.
          </Text>
        ) : null}
      </View>
      {photo ? (
        <DeliveryPhotoSheet
          visible
          onClose={() => {
            setPhoto(false);
          }}
          onUse={(uri) => {
            setPhoto(false);
            onAction({ kind: 'milestone', milestone: 'delivered', photoUri: uri });
          }}
        />
      ) : null}
    </Screen>
  );
}

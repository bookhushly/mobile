import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import {
  SECURITY_STEPS,
  securityBody,
  securityStepReady,
  type SecurityDraft,
  type SecurityStep,
} from '@/features/customer/domain/security/securityRequest';
import { SECURITY_KIND } from '@/features/customer/hooks/rfqKinds';
import { useSecurityDraft, useSecurityPriceGuide } from '@/features/customer/hooks/useSecurity';
import { useRequestSender } from '@/features/customer/hooks/useRequestSender';
import { FlowFooter } from '@/features/customer/ui/car/FlowFooter';
import { StepHeader } from '@/features/customer/ui/car/StepHeader';
import { PickupTimeChips } from '@/features/customer/ui/car/WhenStep';
import { BringStep } from '@/features/customer/ui/security/BringStep';
import { SecurityCheckStep } from '@/features/customer/ui/security/SecurityCheckStep';
import { SecurityDetailsStep } from '@/features/customer/ui/security/SecurityDetailsStep';
import { SecurityServiceStep } from '@/features/customer/ui/security/SecurityServiceStep';
import { SecurityWhenStep } from '@/features/customer/ui/security/SecurityWhenStep';
import { SecurityWhereStep } from '@/features/customer/ui/security/SecurityWhereStep';
import { TeamStep } from '@/features/customer/ui/security/TeamStep';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Screen, Text } from '@/shared/ui';

type Props = {
  /** '' when signed out: every step works; sending asks for sign-in first. */
  userId: string;
  email: string;
  onClose: () => void;
  onSent: (requestId: string) => void;
};

const TITLE: Record<SecurityStep, { title: string; note?: string }> = {
  service: { title: 'What do you need protected?' },
  where: { title: 'Where are the guards needed?' },
  when: { title: 'When do they start?' },
  team: { title: 'Who do you need?' },
  bring: { title: 'What should they bring?', note: 'Optional. Common needs are already on.' },
  details: { title: 'About the place or event', note: 'Optional. It helps companies quote well.' },
  check: { title: 'Check your request' },
};

// Six short steps, the car rental and logistics pattern (layout A photo rows for the service).
export function SecurityFlowScreen({ userId, email, onClose, onSent }: Props) {
  const { draft, step, patch, next, back, edit } = useSecurityDraft(
    useShallow((st) => ({
      draft: st.draft,
      step: st.step,
      patch: st.patch,
      next: st.next,
      back: st.back,
      edit: st.edit,
    })),
  );
  const today = lagosToday(clock.serverNow());
  const sender = useRequestSender({
    kind: SECURITY_KIND,
    store: useSecurityDraft,
    userId,
    email,
    firstStep: 'service',
    checkStep: 'check',
    bodyOf: (d: SecurityDraft, c) => securityBody(d, c, today),
    onSent,
  });
  const guide = useSecurityPriceGuide(draft.state, draft.guardType, draft.duration);
  const index = SECURITY_STEPS.indexOf(step);
  const ready = securityStepReady(step, draft, today);

  const { title, note } = TITLE[step];
  const heading = (
    <View style={{ gap: space.s2 }}>
      <Text variant="titleLg" accessibilityRole="header">
        {title}
      </Text>
      {note === undefined ? null : (
        <Text variant="bodySm" tone="textSecondary">
          {note}
        </Text>
      )}
    </View>
  );

  let body: ReactNode;
  switch (step) {
    case 'service':
      body = <SecurityServiceStep draft={draft} onChange={patch} />;
      break;
    case 'where':
      body = <SecurityWhereStep draft={draft} onChange={patch} />;
      break;
    case 'when':
      body = <SecurityWhenStep draft={draft} today={today} title={heading} onChange={patch} />;
      break;
    case 'team':
      body = <TeamStep draft={draft} onChange={patch} />;
      break;
    case 'bring':
      body = <BringStep draft={draft} onChange={patch} />;
      break;
    case 'details':
      body = <SecurityDetailsStep draft={draft} onChange={patch} />;
      break;
    case 'check':
      body = (
        <SecurityCheckStep
          draft={draft}
          guide={guide}
          askName={sender.askName}
          name={sender.typedName}
          nameError={sender.nameError}
          onName={sender.setTypedName}
          askPhone={sender.askPhone}
          phone={sender.typedPhone}
          phoneError={sender.phoneError}
          onPhone={sender.setTypedPhone}
          onEdit={edit}
        />
      );
      break;
  }

  return (
    <Screen
      scroll={step !== 'when'}
      header={
        <StepHeader step={index + 1} of={SECURITY_STEPS.length} onBack={back} onClose={onClose} />
      }
      footer={
        <FlowFooter
          above={
            step === 'when' ? (
              <PickupTimeChips
                label="Start time"
                value={draft.startTime}
                onChange={(t) => {
                  patch({ startTime: t });
                }}
              />
            ) : null
          }
          detailsUnknown={sender.detailsUnknown}
          profileLoading={sender.profileLoading}
          onRetryProfile={sender.retryProfile}
          problem={sender.problem}
          label={step === 'check' ? 'Ask for quotes' : 'Next'}
          disabled={!ready || sender.sending}
          loading={sender.sending}
          onPress={() => {
            if (step === 'check') void sender.sendNow();
            else next();
          }}
          testID="security-next"
        />
      }
    >
      <View style={{ flex: step === 'when' ? 1 : undefined, gap: space.s6, paddingTop: space.s5 }}>
        {step === 'when' ? null : heading}
        {body}
      </View>
    </Screen>
  );
}

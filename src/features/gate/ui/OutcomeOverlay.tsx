import { CircleCheck, Clock, OctagonX, RotateCw, WifiOff } from 'lucide-react-native';

import type { OverlayView } from '@/features/gate/domain/scanSession';
import { present, type Tone } from '@/features/gate/domain/present';
import type { OverrideAvailability } from '@/features/gate/offline/offlineGate';
import { OutcomeAction, OutcomeScreen } from '@/shared/ui';

// One icon per outcome; "Couldn't check" says whether it was the connection.
const glyphFor = (tone: Tone, cause: string | null) =>
  tone === 'admitted'
    ? CircleCheck
    : tone === 'used'
      ? Clock
      : tone === 'refused'
        ? OctagonX
        : cause === 'network' || cause === 'timeout' || cause === 'noOfflineList'
          ? WifiOff
          : RotateCw;

type Props = {
  view: OverlayView;
  nowMs: number;
  onDismiss: (id: number) => void;
  onTryAgain: (id: number) => void;
  onSignIn: () => void;
  /** Supervisor override, offered only on "Not in offline list" for a scanned code. */
  onOverride?: (id: number) => void;
  overrideState?: OverrideAvailability;
  /** busy: an approved override is recording (the overlay is locked); failed: it did not. */
  overrideStatus?: 'busy' | 'failed' | null;
};

// All wording and override logic lives here; OutcomeScreen (kit) only lays it out.
export function OutcomeOverlay({
  view,
  nowMs,
  onDismiss,
  onTryAgain,
  onSignIn,
  onOverride,
  overrideState,
  overrideStatus = null,
}: Props) {
  const p = present(view.outcome, nowMs);
  const overridable =
    view.outcome.kind === 'refused' &&
    view.outcome.reason === 'notInList' &&
    view.code !== null &&
    onOverride !== undefined;
  const offerOverride = overridable && overrideState?.kind === 'open';
  const lockLine =
    overridable && overrideState?.kind === 'locked'
      ? `Override locked — try again in ${String(overrideState.minutesLeft)} min`
      : null;
  const failLine =
    overridable && overrideStatus === 'failed' ? 'Couldn’t override — try again' : null;
  const busy = overridable && overrideStatus === 'busy';
  const tone: Tone = p.tone;
  const cause = view.outcome.kind === 'couldntCheck' ? view.outcome.cause : null;
  const chip = view.extraAdmitted > 0 ? `+${String(view.extraAdmitted)} admitted` : null;
  const announced = [p.title, p.detail, p.secondary, p.tag, chip, lockLine, failLine]
    .filter((s): s is string => s !== null && s !== '')
    .join('. ');
  const lines = [
    ...(p.detail !== '' ? [{ text: p.detail, size: 'detail' as const }] : []),
    ...[p.secondary, chip, lockLine, failLine]
      .filter((s): s is string => s !== null && s !== '')
      .map((text) => ({ text, size: 'secondary' as const })),
  ];
  // Ink controls on the amber fill; white elsewhere.
  const dark = tone === 'used';
  const dismiss = () => {
    onDismiss(view.id);
  };
  return (
    <OutcomeScreen
      testID="outcome-overlay"
      tone={tone}
      icon={glyphFor(tone, cause)}
      iconTestID={`outcome-icon-${p.title}`}
      title={p.title}
      lines={lines}
      tags={p.tag !== null ? [p.tag] : []}
      announced={announced}
      onBackdropPress={p.holdMs === null ? undefined : dismiss}
      actions={
        p.action === null ? undefined : (
          <>
            {offerOverride ? (
              <OutcomeAction
                dark={dark}
                label={busy ? 'Overriding…' : 'Supervisor override'}
                busy={busy}
                disabled={busy}
                onPress={() => {
                  onOverride(view.id);
                }}
              />
            ) : null}
            {p.action === 'tryAgain' ? (
              <OutcomeAction
                dark={dark}
                primary
                label="Try again"
                onPress={() => {
                  onTryAgain(view.id);
                }}
              />
            ) : null}
            {p.action === 'signIn' ? (
              <OutcomeAction
                dark={dark}
                primary
                label="Sign in again"
                onPress={() => {
                  onSignIn();
                }}
              />
            ) : null}
            {p.action === 'done' ? (
              <OutcomeAction dark={dark} primary label="Done" disabled={busy} onPress={dismiss} />
            ) : null}
            {p.action === 'tryAgain' || p.action === 'signIn' ? (
              <OutcomeAction dark={dark} label="Dismiss" onPress={dismiss} />
            ) : null}
          </>
        )
      }
    />
  );
}

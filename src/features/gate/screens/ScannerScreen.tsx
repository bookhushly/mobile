import { useKeepAwake } from 'expo-keep-awake';
import { ArrowLeft, Flashlight, Keyboard, UserSearch, Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useContext, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import type { ActivityRow } from '@/features/gate/domain/activityCsv';
import { groupDigits } from '@/features/gate/domain/syncLine';
import type { LookupQuery } from '@/features/gate/domain/lookupQuery';
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import type { TicketCode } from '@/features/gate/domain/parseTicketCode';
import type { OverlayView, ScanSession } from '@/features/gate/domain/scanSession';
import type { PinCheck } from '@/features/gate/offline/offlineGate';
import type { ActivityTab, Approval, AttentionItem } from '@/features/gate/offline/outboxStore';
import type { GuestRow } from '@/features/gate/offline/rosterStore';
import type { ScanSummary } from '@/features/gate/schemas/scan';
import { useScanView } from '@/features/gate/state/scanView';
import { useSyncView } from '@/features/gate/state/syncView';
import { ActivityScreen } from '@/features/gate/ui/ActivityScreen';
import { CameraPrompt } from '@/features/gate/ui/CameraPrompt';
import { EnterCodeSheet } from '@/features/gate/ui/EnterCodeSheet';
import { FindGuestSheet } from '@/features/gate/ui/FindGuestSheet';
import { GateStatus } from '@/features/gate/ui/GateStatus';
import { OutcomeOverlay } from '@/features/gate/ui/OutcomeOverlay';
import { PinSheet } from '@/features/gate/ui/PinSheet';
import { RecentSheet } from '@/features/gate/ui/RecentSheet';
import { ScannerCamera, type CameraPermission } from '@/features/gate/ui/ScannerCamera';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { IconButton, Text, ToggleButton } from '@/shared/ui';

type Props = {
  title: string;
  summary: ScanSummary | null;
  summaryStale: boolean;
  focused: boolean;
  permission: CameraPermission;
  canAskPermission: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  muted: boolean;
  onToggleMute: () => void;
  session: Pick<ScanSession, 'scan' | 'tryAgain' | 'dismiss' | 'show'>;
  onSignIn: () => void;
  onChangeEvent: () => void;
  /** Staff pressed Done on "You aren't assigned to this event": leave the scanner. */
  onLostAssignment: () => void;
  onRefreshList: () => void;
  onSyncNow: () => void;
  /** Activity (read-only): one page of a tab, the export rows, and the share sheet. */
  loadActivity: (tab: ActivityTab, beforeSeq: number | null) => Promise<AttentionItem[]>;
  exportActivity: () => Promise<ActivityRow[]>;
  shareCsv: (fileName: string, text: string) => Promise<void>;
  /** Find guest (offline roster lookup); keep these stable, the search re-runs when they change. */
  searchGuests: (q: LookupQuery) => Promise<GuestRow[]>;
  bookingTickets: (bookingId: string) => Promise<GuestRow[]>;
  needsPinForLookup: () => Promise<boolean>;
  checkPin: (pin: string) => Promise<PinCheck>;
  admitFromLookup: (ticketId: string, approval: Approval | null) => Promise<ScanOutcome>;
  /** Supervisor override of a "Not in offline list" code; needs a fresh checkPin grant. */
  override: (
    code: TicketCode,
    approval: { approvedBy: string; reason: string },
  ) => Promise<ScanOutcome>;
  /** Server-corrected now (clock.serverNow). */
  serverNow: () => number;
};

const CORNER = space.s8;
const EDGE = borderWidth.thick * 2;
const corners = [
  { top: 0, left: 0, borderTopWidth: EDGE, borderLeftWidth: EDGE },
  { top: 0, right: 0, borderTopWidth: EDGE, borderRightWidth: EDGE },
  { bottom: 0, left: 0, borderBottomWidth: EDGE, borderLeftWidth: EDGE },
  { bottom: 0, right: 0, borderBottomWidth: EDGE, borderRightWidth: EDGE },
] as const;

function Viewfinder() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: '70%', aspectRatio: 1 }}>
        {corners.map((c, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: CORNER,
              height: CORNER,
              borderColor: color.onInverse,
              ...c,
            }}
          />
        ))}
      </View>
    </View>
  );
}

// One override at a time, tied to the overlay it was started from.
type OverrideFlow = { id: number; code: TicketCode; phase: 'pin' | 'busy' | 'failed' };

type OverlayProps = Pick<Props, 'session' | 'onSignIn' | 'onLostAssignment' | 'serverNow'> & {
  overrideFlow: OverrideFlow | null;
  onOverride: (id: number, code: TicketCode) => void;
};

const lostAssignment = (v: OverlayView) =>
  v.outcome.kind === 'refused' && v.outcome.reason === 'notAssigned';

// Keyed by overlay id so the time used for wording is fixed when each overlay appears.
function OverlayFor(p: OverlayProps & { view: OverlayView }) {
  // Server-corrected: the outcome's times (checked in, list updated) are server times.
  const [nowMs] = useState(() => p.serverNow());
  const overrideState = useSyncView((s) => s.status.override);
  const flow = p.overrideFlow?.id === p.view.id ? p.overrideFlow : null;
  const code = p.view.code;
  return (
    <OutcomeOverlay
      view={p.view}
      nowMs={nowMs}
      onDismiss={(id) => {
        p.session.dismiss(id);
        // The refusal explains why; only leave once staff have read it and pressed Done.
        if (lostAssignment(p.view)) p.onLostAssignment();
      }}
      onTryAgain={p.session.tryAgain}
      onSignIn={p.onSignIn}
      overrideState={overrideState}
      overrideStatus={flow === null || flow.phase === 'pin' ? null : flow.phase}
      onOverride={
        code === null
          ? undefined
          : (id) => {
              p.onOverride(id, code);
            }
      }
    />
  );
}

function Overlay(p: OverlayProps) {
  const current = useScanView((s) => s.view.current);
  if (current === null) return null;
  return <OverlayFor key={current.id} view={current} {...p} />;
}

function Checking() {
  const pending = useScanView((s) => s.view.pending);
  if (pending === 0) return null;
  return (
    <View
      testID="checking-pill"
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.r2,
        paddingVertical: space.s3,
        paddingHorizontal: space.s4,
      }}
    >
      <Text variant="label" tone="textPrimary" accessibilityLiveRegion="polite">
        {`Checking ${String(pending)}…`}
      </Text>
    </View>
  );
}

// Its own component so summary updates re-render only the counter.
function DoorCounter({
  summary,
  stale,
  onPress,
}: {
  summary: ScanSummary | null;
  stale: boolean;
  onPress: () => void;
}) {
  const status = useSyncView((s) => s.status);
  const local = status.mode === 'offline' ? status.localCounts : null;
  const shown = local ?? summary;
  const admitted = shown === null ? '—' : groupDigits(shown.admitted);
  const total = shown !== null && shown.total > 0 ? groupDigits(shown.total) : null;
  const caption = local !== null ? 'offline' : stale ? 'not updated' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${admitted} admitted${total !== null ? ` of ${total}` : ''}${
        caption !== null ? `, ${caption}` : ''
      }. Open recent admissions`}
      onPress={onPress}
      hitSlop={8}
    >
      <Text variant="numLg" tone="onInverse" tabular>
        {admitted}
      </Text>
      <Text variant="label" tone="onInverse">
        admitted
      </Text>
      {total !== null ? (
        <Text variant="caption" tone="onInverse">
          {`of ${total}`}
        </Text>
      ) : null}
      {caption !== null ? (
        <Text variant="caption" tone="onInverse">
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ScannerScreen(p: Props) {
  useKeepAwake();
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  const [torch, setTorch] = useState(false);
  const [entering, setEntering] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [activityTab, setActivityTab] = useState<ActivityTab | null>(null);
  const [finding, setFinding] = useState(false);
  const [overrideFlow, setOverrideFlow] = useState<OverrideFlow | null>(null);
  // Set from approval until the override settles: a second approval or tap is ignored.
  const overriding = useRef(false);
  // Stable so the memoised camera never re-renders for unrelated screen state (perf budget).
  const session = p.session;
  const onCode = useCallback(
    (raw: string) => {
      session.scan(raw, 'camera');
    },
    [session],
  );

  const startOverride = (id: number, code: TicketCode) => {
    if (overriding.current) return;
    setOverrideFlow({ id, code, phase: 'pin' });
  };
  const settle = (id: number, phase: 'failed' | null) => {
    setOverrideFlow((f) => (f?.id !== id ? f : phase === null ? null : { ...f, phase }));
  };
  async function runOverride(flow: OverrideFlow, approval: Approval) {
    if (overriding.current) return;
    overriding.current = true;
    setOverrideFlow({ ...flow, phase: 'busy' });
    let outcome: ScanOutcome;
    try {
      // The PIN sheet requires a reason for an override; a missing one is refused by the gate.
      outcome = await p.override(flow.code, {
        approvedBy: approval.approvedBy,
        reason: approval.reason ?? '',
      });
    } catch {
      overriding.current = false;
      settle(flow.id, 'failed');
      return;
    }
    overriding.current = false;
    settle(flow.id, null);
    // The override is recorded: its outcome replaces the refusal whatever happened meanwhile.
    session.dismiss(flow.id);
    session.show(outcome);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.inverse }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s3,
          paddingHorizontal: space.s4,
        }}
      >
        <IconButton
          icon={ArrowLeft}
          variant="inverse"
          accessibilityLabel="Change event"
          onPress={p.onChangeEvent}
        />
        <Text variant="bodyStrong" tone="onInverse" numberOfLines={1} style={{ flex: 1 }}>
          {p.title}
        </Text>
        <ToggleButton
          icon={VolumeX}
          iconOn={Volume2}
          label="Sound"
          hideLabel
          variant="inverse"
          checked={!p.muted}
          onChange={p.onToggleMute}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: space.s5,
        }}
      >
        <DoorCounter
          summary={p.summary}
          stale={p.summaryStale}
          onPress={() => {
            setShowRecent(true);
          }}
        />
        <GateStatus now={p.serverNow} onOpen={setActivityTab} />
      </View>
      <View style={{ flex: 1 }}>
        {p.permission === 'granted' && p.focused ? (
          <>
            <ScannerCamera
              torch={torch}
              paused={
                entering ||
                showRecent ||
                activityTab !== null ||
                finding ||
                overrideFlow?.phase === 'pin' ||
                overrideFlow?.phase === 'busy'
              }
              onCode={onCode}
            />
            <Viewfinder />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: space.s5,
                left: 0,
                right: 0,
                alignItems: 'center',
              }}
            >
              <Text variant="body" tone="onInverse">
                Point at the ticket QR code
              </Text>
            </View>
          </>
        ) : null}
        {p.permission === 'granted' && !p.focused ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="body" tone="onInverse">
              Camera paused
            </Text>
          </View>
        ) : null}
        {p.permission !== 'granted' ? (
          <CameraPrompt
            state={p.permission === 'unknown' ? 'ask' : 'denied'}
            canAsk={p.canAskPermission}
            onAllow={p.onRequestPermission}
            onOpenSettings={p.onOpenSettings}
            onEnterByHand={() => {
              setEntering(true);
            }}
          />
        ) : null}
        <View style={{ position: 'absolute', top: space.s4, left: space.s4 }}>
          <Checking />
        </View>
      </View>

      <View
        testID="scanner-controls"
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingTop: space.s4,
          paddingBottom: Math.max(insets.bottom, space.s5),
        }}
      >
        <ToggleButton
          icon={Flashlight}
          label="Torch"
          variant="inverse"
          size="lg"
          checked={torch}
          onChange={setTorch}
        />
        <IconButton
          icon={UserSearch}
          label="Find guest"
          accessibilityLabel="Find guest"
          variant="filled"
          size="lg"
          onPress={() => {
            setFinding(true);
          }}
        />
        <IconButton
          icon={Keyboard}
          label="Enter code"
          accessibilityLabel="Enter code"
          variant="inverse"
          size="lg"
          onPress={() => {
            setEntering(true);
          }}
        />
      </View>

      <Overlay
        session={p.session}
        onSignIn={p.onSignIn}
        onLostAssignment={p.onLostAssignment}
        serverNow={p.serverNow}
        overrideFlow={overrideFlow}
        onOverride={startOverride}
      />

      <EnterCodeSheet
        visible={entering}
        onClose={() => {
          setEntering(false);
        }}
        onSubmit={(raw) => {
          setEntering(false);
          p.session.scan(raw, 'manual');
        }}
      />
      <RecentSheet
        visible={showRecent}
        recent={p.summary?.recent ?? null}
        onClose={() => {
          setShowRecent(false);
        }}
      />
      <FindGuestSheet
        visible={finding}
        search={p.searchGuests}
        bookingTickets={p.bookingTickets}
        needsPin={p.needsPinForLookup}
        checkPin={p.checkPin}
        admit={p.admitFromLookup}
        onAdmitted={(o) => {
          setFinding(false);
          p.session.show(o);
        }}
        onClose={() => {
          setFinding(false);
        }}
      />
      <PinSheet
        visible={overrideFlow?.phase === 'pin'}
        purpose="override"
        check={p.checkPin}
        onApproved={(approval) => {
          if (overrideFlow !== null) void runOverride(overrideFlow, approval);
        }}
        onClose={() => {
          setOverrideFlow((f) => (f?.phase === 'pin' ? null : f));
        }}
      />
      <ActivityScreen
        visible={activityTab !== null}
        initialTab={activityTab ?? 'attention'}
        load={p.loadActivity}
        exportRows={p.exportActivity}
        share={p.shareCsv}
        onSyncNow={p.onSyncNow}
        onRefreshList={p.onRefreshList}
        now={p.serverNow}
        onClose={() => {
          setActivityTab(null);
        }}
      />
    </SafeAreaView>
  );
}

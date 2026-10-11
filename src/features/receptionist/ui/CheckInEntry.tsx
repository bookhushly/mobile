import { Linking, View } from 'react-native';

import { color, radius } from '@/shared/theme';
import { Input, SegmentedControl, Stack, Text } from '@/shared/ui';
import { CameraPrompt, QrCamera, useAppActive, useCameraAccess } from '@/shared/ui/camera';

export type EntryTab = 'type' | 'scan';

const TABS: readonly { value: EntryTab; label: string }[] = [
  { value: 'type', label: 'Type code' },
  { value: 'scan', label: 'Scan QR' },
];

type Props = {
  tab: EntryTab;
  onTab: (tab: EntryTab) => void;
  value: string;
  onChangeValue: (v: string) => void;
  error: string | null;
  onFind: () => void;
  /** The camera runs only while the sheet is up and the flow is waiting for a code. */
  cameraOn: boolean;
  onScan: (raw: string) => void;
};

function ScanPane({
  on,
  error,
  onScan,
  onTypeInstead,
}: {
  on: boolean;
  error: string | null;
  onScan: (raw: string) => void;
  onTypeInstead: () => void;
}) {
  const { permission, canAsk, request } = useCameraAccess();
  const active = useAppActive();
  if (permission === 'unknown' || permission === 'denied')
    return (
      <CameraPrompt
        state={permission === 'unknown' ? 'ask' : 'denied'}
        canAsk={canAsk}
        tone="default"
        askTitle="Allow camera to scan check-in codes"
        body="The camera is only used to read check-in codes. Nothing is recorded."
        byHandLabel="Type the code instead"
        onAllow={request}
        onOpenSettings={() => {
          void Linking.openSettings().catch(() => undefined);
        }}
        onEnterByHand={onTypeInstead}
      />
    );
  return (
    <Stack gap="s3">
      <View
        testID="scan-box"
        style={{
          aspectRatio: 1,
          borderRadius: radius.r3,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: color.inverse,
        }}
      >
        {on && active && permission === 'granted' ? (
          <QrCamera torch={false} paused={false} onCode={onScan} />
        ) : null}
      </View>
      <Text variant="bodySm" tone={error === null ? 'textSecondary' : 'dangerFg'}>
        {error ?? "Point the camera at the guest's QR code."}
      </Text>
    </Stack>
  );
}

// Step "entry" of the check-in sheet: Type code (default, R13) or Scan QR.
export function CheckInEntry({
  tab,
  onTab,
  value,
  onChangeValue,
  error,
  onFind,
  cameraOn,
  onScan,
}: Props) {
  return (
    <Stack gap="s5">
      <SegmentedControl value={tab} options={TABS} onChange={onTab} testID="check-in-tabs" />
      {tab === 'type' ? (
        <Input
          label="Check-in code"
          value={value}
          onChangeText={onChangeValue}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={12}
          returnKeyType="search"
          onSubmitEditing={onFind}
          error={error ?? undefined}
          hint="8 letters and numbers, on the guest's booking"
        />
      ) : (
        <ScanPane
          on={cameraOn}
          error={error}
          onScan={onScan}
          onTypeInstead={() => {
            onTab('type');
          }}
        />
      )}
    </Stack>
  );
}

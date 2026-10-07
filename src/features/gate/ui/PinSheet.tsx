import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isPinShape } from '@/features/gate/domain/overridePin';
import type { PinCheck } from '@/features/gate/offline/offlineGate';
import type { Approval } from '@/features/gate/offline/outboxStore';
import { color, space } from '@/shared/theme';
import { Button, Input, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  purpose: 'override' | 'lookup';
  check: (pin: string) => Promise<PinCheck>;
  onApproved: (approval: Approval) => void;
  onClose: () => void;
};

const message = (r: PinCheck | 'failed' | null): string | null => {
  if (r === null) return null;
  if (r === 'failed') return 'Override isn’t available right now — try again';
  switch (r.kind) {
    case 'wrong':
      return `Wrong PIN — ${String(r.triesLeft)} ${r.triesLeft === 1 ? 'try' : 'tries'} left`;
    case 'locked':
      return `Override locked — try again in ${String(r.minutesLeft)} min`;
    case 'unavailable':
      return 'Override isn’t available for this event';
    case 'ok':
      return null;
  }
};

// The gate serialises checks and counts attempts; the sheet only guards against double taps and
// never keeps or logs the PIN beyond this field's state.
export function PinSheet({ visible, purpose, check, onApproved, onClose }: Props) {
  const [pin, setPin] = useState('');
  const [approver, setApprover] = useState('');
  const [reason, setReason] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PinCheck | 'failed' | null>(null);
  const busy = useRef(false);
  const gen = useRef(0);
  const [wasVisible, setWasVisible] = useState(visible);

  // Reset on close (adjusting state during render, not in an effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setPin('');
      setApprover('');
      setReason('');
      setChecking(false);
      setResult(null);
    }
  }
  useEffect(() => {
    if (!visible) {
      gen.current += 1;
      busy.current = false;
    }
  }, [visible]);

  const who = approver.trim();
  const why = reason.trim();
  const reasonOk = purpose === 'override' ? why.length >= 3 && why.length <= 200 : why.length <= 200;
  const locked = result !== null && result !== 'failed' && result.kind === 'locked';
  const valid = isPinShape(pin) && who.length >= 1 && who.length <= 80 && reasonOk;

  async function confirm() {
    if (busy.current || !valid || locked) return;
    busy.current = true;
    const mine = gen.current;
    setChecking(true);
    setResult(null);
    let r: PinCheck | 'failed';
    try {
      r = await check(pin);
    } catch {
      r = 'failed';
    }
    if (mine !== gen.current) return;
    busy.current = false;
    setChecking(false);
    if (r !== 'failed' && r.kind === 'ok') {
      onApproved({ approvedBy: who, reason: why === '' ? null : why });
      return;
    }
    if (r !== 'failed' && r.kind === 'wrong') setPin('');
    setResult(r);
  }

  const text = message(result);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: space.s5, gap: space.s4 }}
        >
          <Text variant="title" accessibilityRole="header">
            {purpose === 'override' ? 'Supervisor override' : 'Supervisor approval'}
          </Text>
          <Text variant="bodySm" tone="textSecondary">
            A supervisor enters the event PIN. Every override is logged.
          </Text>
          <Input
            label="PIN"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoComplete="off"
          />
          <Input
            label="Approver"
            value={approver}
            onChangeText={setApprover}
            maxLength={80}
            autoCapitalize="words"
          />
          <Input
            label={purpose === 'override' ? 'Reason' : 'Reason (optional)'}
            value={reason}
            onChangeText={setReason}
            maxLength={200}
          />
          {text !== null ? (
            <Text
              variant="bodyStrong"
              accessibilityLiveRegion="polite"
              style={{ color: color.status.danger.solid }}
            >
              {text}
            </Text>
          ) : null}
          <Button
            label={checking ? 'Checking…' : 'Confirm'}
            onPress={() => void confirm()}
            disabled={!valid || checking || locked}
          />
          <Button variant="secondary" label="Cancel" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

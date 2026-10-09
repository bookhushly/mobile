import { X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import type { AccountFailure } from '@/features/auth/api/accountApi';
import { passwordRules, RULES } from '@/features/auth/domain/passwordRules';
import { WEAK_PASSWORD_MESSAGE } from '@/features/auth/domain/signUpErrors';
import type { Result } from '@/shared/lib/result';
import { Banner, Button, IconButton, PasswordField, RuleList, Screen, Stack, Text } from '@/shared/ui';

type Props = {
  onSave: (password: string) => Promise<Result<true, AccountFailure>>;
  onSaved: () => void;
  /** Cancel, or an expired reset: the route signs out (spec decision 4). */
  onLeave: () => void;
};

// `expired`: the reset session is gone; the only way forward is a new code.
type Notice = { kind: 'neutral'; message: string } | { kind: 'expired' };

const TOO_LONG_MESSAGE = 'That password is too long';
const EXPIRED_MESSAGE = 'Your reset expired. Start again.';
const FAILED_MESSAGE = "We couldn't save your password. Try again.";

function transientMessage(retryAfterSec: number | undefined): string {
  const when = retryAfterSec === undefined ? 'a minute' : `${String(retryAfterSec)} seconds`;
  return `We couldn’t reach Bookhushly — try again in ${when}`;
}

export function NewPasswordScreen({ onSave, onSaved, onLeave }: Props) {
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  // Single-flight: `saving` lags a render behind a double tap, the ref does not.
  const inFlight = useRef(false);

  const rules = passwordRules(password);

  async function save() {
    if (inFlight.current || !rules.ok) return;
    inFlight.current = true;
    setSaving(true);
    // Each attempt starts clean so nothing from the last one outlives a retry.
    setFieldError(undefined);
    setNotice(null);
    try {
      const r = await onSave(password);
      if (r.ok) {
        onSaved();
        return;
      }
      const e = r.error;
      switch (e.kind) {
        case 'weakPassword':
        case 'invalid':
          setFieldError(e.fields.password ?? WEAK_PASSWORD_MESSAGE);
          break;
        case 'unauthorized':
          setNotice({ kind: 'expired' });
          break;
        case 'transient':
          setNotice({ kind: 'neutral', message: transientMessage(e.retryAfterSec) });
          break;
        case 'failed':
        case 'emailTaken':
        case 'notCustomer':
        case 'blocked':
          // The last three cannot come from reset-password; the message still says what to do.
          setNotice({ kind: 'neutral', message: FAILED_MESSAGE });
      }
    } catch {
      setNotice({ kind: 'neutral', message: FAILED_MESSAGE });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen
      scroll
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
          <IconButton icon={X} accessibilityLabel="Cancel" onPress={onLeave} />
        </View>
      }
    >
      <Stack gap="s3">
        <Text variant="displaySm" accessibilityRole="header">
          Choose a new password
        </Text>
        <Text variant="body" tone="textSecondary">
          You’ll use it the next time you sign in.
        </Text>
      </Stack>
      <Stack gap="s4">
        <Stack gap="s3">
          <PasswordField
            label="New password"
            value={password}
            onChangeText={setPassword}
            error={fieldError}
            returnKeyType="go"
            onSubmitEditing={() => {
              void save();
            }}
            autoComplete="new-password"
            textContentType="newPassword"
          />
          {rules.tooLong ? (
            <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
              {TOO_LONG_MESSAGE}
            </Text>
          ) : null}
          <RuleList
            rules={RULES.map((r) => ({ id: r.id, label: r.label, met: rules.met[r.id] }))}
            touched={password.length > 0}
          />
        </Stack>
        {notice?.kind === 'neutral' ? (
          <Banner tone="neutral" message={notice.message} live="polite" />
        ) : null}
        {notice?.kind === 'expired' ? (
          <Banner
            tone="warning"
            message={EXPIRED_MESSAGE}
            action={{ label: 'Start again', onPress: onLeave }}
            live="polite"
          />
        ) : null}
        <Button
          label="Save password"
          disabled={!rules.ok}
          loading={saving}
          onPress={() => {
            void save();
          }}
        />
      </Stack>
    </Screen>
  );
}

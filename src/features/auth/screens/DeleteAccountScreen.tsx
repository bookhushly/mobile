import { UserRound } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import type { AccountFailure } from '@/features/auth/api/accountApi';
import { unsyncedWarning } from '@/features/auth/domain/deletionPlan';
import { transientMessage } from '@/features/auth/domain/transientMessage';
import type { Result } from '@/shared/lib/result';
import { space } from '@/shared/theme';
import { Banner, Button, Card, Icon, Input, PasswordField, Screen, Stack, Text } from '@/shared/ui';

type PasswordCheck = 'ok' | 'wrong' | 'transient' | 'closed';

type Props = {
  email: string;
  /** Gate admissions still waiting to sync; `null` while counting, `-1` when it could not be read. */
  unsynced: number | null;
  onCheckPassword: (password: string) => Promise<PasswordCheck>;
  onDelete: () => Promise<Result<true, AccountFailure>>;
  /** After an uncertain delete: did a session refresh fail with `user_banned` (it went through)? */
  onConfirmDeletedAfterUncertain: () => Promise<boolean>;
  onDeleted: () => void;
  onCancel: () => void;
};

type Notice =
  | { tone: 'neutral' | 'info'; message: string }
  | { tone: 'warning'; title: string; message: string };

const CONFIRM_WORD = 'DELETE';
const WRONG_PASSWORD = 'That password isn’t right';
const BLOCKED_TITLE = 'You can’t delete your account yet';
const UNCONFIRMED = 'We couldn’t confirm the deletion. Sign in again to check.';
const FAILED = 'We couldn’t delete your account. Try again.';
const EXPLANATION =
  'Deleting removes your name, email, phone and saved items. Booking and payment records are kept, anonymised, because the law requires them. This can’t be undone.';

export function DeleteAccountScreen({
  email,
  unsynced,
  onCheckPassword,
  onDelete,
  onConfirmDeletedAfterUncertain,
  onDeleted,
  onCancel,
}: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Single-flight: `deleting` lags a render behind a double tap, the ref does not.
  const inFlight = useRef(false);
  // Once the account is gone the lock stays held: the screen is being torn down and a second
  // tap must never send another delete.
  const finished = useRef(false);
  // A delete that failed without a verdict (transient, failed, thrown) may still have gone
  // through: the server renames the login, so a retry's password check would read as "wrong
  // password" (contract §1.5). While uncertain, the session is asked first.
  const uncertain = useRef(false);

  function deleted() {
    finished.current = true;
    onDeleted();
  }

  const ready = password.length > 0 && confirm === CONFIRM_WORD;
  const warning = unsynced === null ? null : unsyncedWarning(unsynced);

  async function run() {
    if (inFlight.current || !ready) return;
    inFlight.current = true;
    setDeleting(true);
    setFieldError(undefined);
    setNotice(null);
    try {
      if (uncertain.current && (await onConfirmDeletedAfterUncertain())) {
        deleted();
        return;
      }
      // The password is checked in the app and never sent to the delete route (decision 3).
      const check = await onCheckPassword(password);
      if (check === 'wrong') {
        // The renamed login of a deleted account also reads as "wrong": ask the session again.
        if (uncertain.current && (await onConfirmDeletedAfterUncertain())) {
          deleted();
          return;
        }
        setFieldError(WRONG_PASSWORD);
        return;
      }
      if (check === 'transient') {
        setNotice({ tone: 'neutral', message: transientMessage(undefined) });
        return;
      }
      if (check === 'closed') {
        // Banned already: an earlier delete's 200 was lost. Nothing left to delete.
        deleted();
        return;
      }
      const r = await onDelete();
      if (r.ok) {
        deleted();
        return;
      }
      const e = r.error;
      switch (e.kind) {
        case 'blocked':
          setNotice({
            tone: 'warning',
            title: BLOCKED_TITLE,
            message: e.reasons.map((x) => x.detail).join('\n'),
          });
          break;
        case 'notCustomer':
          setNotice({ tone: 'info', message: e.message });
          break;
        case 'unauthorized':
          // A lost 200 makes the retry a 401 (the account is banned): ask the session instead.
          if (await onConfirmDeletedAfterUncertain()) deleted();
          else setNotice({ tone: 'neutral', message: UNCONFIRMED });
          break;
        case 'transient':
          uncertain.current = true;
          setNotice({ tone: 'neutral', message: transientMessage(e.retryAfterSec) });
          break;
        case 'failed':
        case 'invalid':
        case 'weakPassword':
        case 'emailTaken':
          // The last three cannot come from the delete route; all are safe to retry.
          uncertain.current = true;
          setNotice({ tone: 'neutral', message: FAILED });
      }
    } catch {
      uncertain.current = true;
      setNotice({ tone: 'neutral', message: FAILED });
    } finally {
      if (!finished.current) {
        inFlight.current = false;
        setDeleting(false);
      }
    }
  }

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            variant="destructive"
            label="Delete account"
            disabled={!ready}
            loading={deleting}
            onPress={() => {
              void run();
            }}
          />
          <Button variant="secondary" label="Cancel" onPress={onCancel} />
        </>
      }
    >
      <Stack gap="s3">
        <Text variant="displaySm" accessibilityRole="header">
          Delete your account
        </Text>
        <Text variant="body" tone="textSecondary">
          {EXPLANATION}
        </Text>
      </Stack>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
          <Icon as={UserRound} size="lg" tone="textSecondary" />
          <Stack gap="s1" flex={1}>
            <Text variant="label" tone="textMuted">
              Signed in as
            </Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {email}
            </Text>
          </Stack>
        </View>
      </Card>
      {warning !== null ? (
        <Banner tone="warning" message={warning} testID="unsynced-banner" />
      ) : null}
      <Stack gap="s4">
        <PasswordField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldError}
          autoComplete="current-password"
          textContentType="password"
        />
        <Input
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={() => {
            void run();
          }}
        />
        {notice !== null ? (
          notice.tone === 'warning' ? (
            <Banner tone="warning" title={notice.title} message={notice.message} />
          ) : (
            <Banner tone={notice.tone} message={notice.message} />
          )
        ) : null}
      </Stack>
    </Screen>
  );
}

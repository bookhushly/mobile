import { useCallback } from 'react';
import { Alert } from 'react-native';

import { syncThenSignOut } from '@/features/auth/domain/syncThenSignOut';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { SignOutOptions } from '@/features/auth/domain/signOutPlan';
import { hasShiftActivity, summaryLine } from '@/features/auth/domain/shiftSummary';
import {
  resetShiftSummary,
  shiftSummary,
  syncBeforeSignOut,
  type SignOutCheck,
} from '@/shared/lib/signOutGuard';
import { captureException } from '@/shared/monitoring';

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

type SignOutResult = { blocked: SignOutCheck | null; incomplete?: true };
type SignOut = (opts?: SignOutOptions) => Promise<SignOutResult>;

/** The session couldn't be removed from this phone: say so neutrally; the user is still in. */
export function alertIfIncomplete(r: SignOutResult): void {
  if (r.incomplete === true) Alert.alert('Couldn’t finish signing out — try again');
}

function confirmDiscard(unsyncable: number, signOut: SignOut): void {
  Alert.alert(
    `${plural(unsyncable, 'admission', 'admissions')} can’t be sent`,
    'You were removed from the event, or the server refused them. Tell the organiser. Signing out deletes them from this phone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut({ discardUnsyncable: true });
        },
      },
    ],
  );
}

// The gate data was written by a newer app version: nothing here can count or sync it.
function alertUpdateFirst(signOut: SignOut): void {
  Alert.alert(
    'Update the app before signing out',
    'This version can’t read what’s saved on this phone, including admissions that may not have synced. If you sign out now, they stay on this phone and sync when you sign in to this account on the updated app.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Sign out anyway',
        // Keeps every guard's data (today only the gate's); none of it is counted or shown here.
        onPress: () => {
          void signOut({ keepOfflineData: true });
        },
      },
    ],
  );
}

export async function syncThenRetry(uid: string, signOut: SignOut): Promise<void> {
  const left = await syncThenSignOut({
    sync: () => syncBeforeSignOut(uid),
    signOut: () => signOut(),
    report: captureException,
  });
  if (left === null) return;
  if (left.appOutdated === true) {
    alertUpdateFirst(signOut);
    return;
  }
  if (left.unsynced > 0) {
    Alert.alert(
      `${plural(left.unsynced, 'admission still hasn’t', 'admissions still haven’t')} synced`,
      'Connect to the internet and try again.',
    );
    return;
  }
  confirmDiscard(left.unsyncable, signOut);
}

export async function runSignOut(userId: string | null, signOut: SignOut): Promise<void> {
  const r = await signOut();
  if (r.blocked === null) return;
  if (r.blocked.appOutdated === true) {
    alertUpdateFirst(signOut);
    return;
  }
  const { unsynced, unsyncable } = r.blocked;
  if (unsynced === 0) {
    confirmDiscard(unsyncable, signOut);
    return;
  }
  Alert.alert(
    `${plural(unsynced, 'admission hasn’t', 'admissions haven’t')} synced`,
    'Connect to the internet and sync before signing out, so no admission is lost.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Sync now',
        onPress: () => {
          if (userId !== null) void syncThenRetry(userId, signOut);
        },
      },
    ],
  );
}

async function startSignOut(userId: string | null, signOut: SignOut): Promise<void> {
  const summary = userId === null ? null : await shiftSummary(userId);
  if (userId === null || summary === null || !hasShiftActivity(summary)) {
    await runSignOut(userId, signOut);
    return;
  }
  Alert.alert('Sign out?', summaryLine(summary), [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Reset counts',
      onPress: () => {
        void resetShiftSummary(userId).catch(captureException);
      },
    },
    {
      text: 'Sign out',
      onPress: () => {
        void runSignOut(userId, signOut);
      },
    },
  ]);
}

// FR-3.11: a voluntary sign-out never silently drops gate admissions.
export function useSignOut(): () => void {
  const signOut = useAuth((s) => s.signOut);
  const userId = useAuth((s) => (s.state.status === 'signedIn' ? s.state.userId : null));
  return useCallback(() => {
    const reporting: SignOut = async (opts) => {
      const r = await signOut(opts);
      alertIfIncomplete(r);
      return r;
    };
    void startSignOut(userId, reporting);
  }, [signOut, userId]);
}

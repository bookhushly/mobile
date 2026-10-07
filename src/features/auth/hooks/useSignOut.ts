import { useCallback } from 'react';
import { Alert } from 'react-native';

import { syncThenSignOut } from '@/features/auth/domain/syncThenSignOut';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { SignOutOptions } from '@/features/auth/domain/signOutPlan';
import { syncBeforeSignOut, type SignOutCheck } from '@/shared/lib/signOutGuard';
import { captureException } from '@/shared/monitoring';

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

type SignOut = (opts?: SignOutOptions) => Promise<{ blocked: SignOutCheck | null }>;

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

// FR-3.11: a voluntary sign-out never silently drops gate admissions.
export function useSignOut(): () => void {
  const signOut = useAuth((s) => s.signOut);
  const userId = useAuth((s) => (s.state.status === 'signedIn' ? s.state.userId : null));
  return useCallback(() => {
    const syncNow = async (uid: string) => {
      const left = await syncThenSignOut({
        sync: () => syncBeforeSignOut(uid),
        signOut: () => signOut(),
        report: captureException,
      });
      if (left === null) return;
      if (left.unsynced > 0) {
        Alert.alert(
          `${plural(left.unsynced, 'admission still hasn’t', 'admissions still haven’t')} synced`,
          'Connect to the internet and try again.',
        );
        return;
      }
      confirmDiscard(left.unsyncable, signOut);
    };
    void (async () => {
      const r = await signOut();
      if (r.blocked === null) return;
      const { unsynced, unsyncable } = r.blocked;
      if (unsynced > 0) {
        Alert.alert(
          `${plural(unsynced, 'admission hasn’t', 'admissions haven’t')} synced`,
          'Connect to the internet and sync before signing out, so no admission is lost.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Sync now',
              onPress: () => {
                if (userId !== null) void syncNow(userId);
              },
            },
          ],
        );
        return;
      }
      confirmDiscard(unsyncable, signOut);
    })();
  }, [signOut, userId]);
}

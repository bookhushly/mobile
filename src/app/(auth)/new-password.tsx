import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

import { resetPassword } from '@/features/auth/api/accountApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { NewPasswordScreen } from '@/features/auth/screens/NewPasswordScreen';
import { api } from '@/shared/api/instance';

export default function NewPasswordRoute() {
  const finishRecovery = useAuth((s) => s.finishRecovery);
  const abandonRecovery = useAuth((s) => s.abandonRecovery);
  // Set synchronously on a successful save, before `finishRecovery` clears the store flag: the
  // unmount cleanup and the hardware back button must never sign the user out after a save.
  const saved = useRef(false);
  // Leaving twice (Cancel then back) must not sign out twice or replace the route twice.
  const leaving = useRef(false);

  // Cancel, Start again or Android back: the reset is abandoned (spec decision 4). The store
  // keeps `recovery` until this device is signed out, so the auth group stays in front
  // throughout; this screen then leaves for Welcome itself.
  const leave = () => {
    if (saved.current || leaving.current) return;
    leaving.current = true;
    void abandonRecovery().then(() => {
      router.replace('/welcome');
    });
  };

  useEffect(() => {
    // Android hardware back: never just pops.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => {
      sub.remove();
    };
  });

  useEffect(
    () => () => {
      // Unmounted some other way (e.g. the navigator reset) while the reset is still in progress.
      if (!saved.current && !leaving.current && useAuth.getState().recovery) {
        void useAuth.getState().abandonRecovery();
      }
    },
    [],
  );

  return (
    <NewPasswordScreen
      onSave={(password) => resetPassword(api, password)}
      onSaved={() => {
        saved.current = true;
        // Clearing `recovery` lets the root layout resolve the mode and leave the auth screens.
        void finishRecovery();
      }}
      onLeave={leave}
    />
  );
}

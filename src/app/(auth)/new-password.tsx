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

  const leave = () => {
    if (saved.current) return;
    void abandonRecovery();
  };

  useEffect(() => {
    // Android hardware back: leaving the reset signs out (spec decision 4), never just pops.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!saved.current) void abandonRecovery();
      return true;
    });
    return () => {
      sub.remove();
    };
  }, [abandonRecovery]);

  useEffect(
    () => () => {
      // Unmounted some other way (e.g. the navigator reset) while the reset is still in progress.
      if (!saved.current && useAuth.getState().recovery) void useAuth.getState().abandonRecovery();
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

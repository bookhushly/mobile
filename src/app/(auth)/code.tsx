import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { z } from 'zod';

import { forgotPassword, resendConfirmation } from '@/features/auth/api/accountApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CodeScreen } from '@/features/auth/screens/CodeScreen';
import { api } from '@/shared/api/instance';

const MAIL_URL = 'message://';

const params = z.object({
  purpose: z.enum(['signup', 'confirm', 'recovery']),
  email: z.string().trim().min(1),
});

export default function CodeRoute() {
  const raw = useLocalSearchParams<{ purpose?: string; email?: string }>();
  const parsed = params.safeParse(raw);
  const verifyCode = useAuth((s) => s.verifyCode);
  const [canOpenMail, setCanOpenMail] = useState(false);

  useEffect(() => {
    if (!parsed.success) router.replace('/welcome');
  }, [parsed.success]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let live = true;
    // Rejects on iOS when the scheme isn't in LSApplicationQueriesSchemes: treat as "can't".
    Linking.canOpenURL(MAIL_URL)
      .then((ok) => {
        if (live) setCanOpenMail(ok);
      })
      .catch(() => {
        if (live) setCanOpenMail(false);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!parsed.success) return null;
  const { purpose, email } = parsed.data;
  const recovery = purpose === 'recovery';

  return (
    <CodeScreen
      purpose={purpose}
      email={email}
      now={() => Date.now()}
      onVerify={(code) => verifyCode(email, code, recovery ? 'recovery' : 'signup')}
      onResend={() => (recovery ? forgotPassword(api, email) : resendConfirmation(api, email))}
      onChangeEmail={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/welcome');
      }}
      onVerified={() => {
        // Sign-up and confirm: the root layout routes on the new session by itself.
        if (recovery) router.replace('/new-password');
      }}
      canOpenMail={canOpenMail}
      onOpenMail={() => {
        void Linking.openURL(MAIL_URL);
      }}
    />
  );
}

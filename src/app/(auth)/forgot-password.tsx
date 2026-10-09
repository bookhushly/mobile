import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { forgotPassword } from '@/features/auth/api/accountApi';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { api } from '@/shared/api/instance';

// The address is only a prefill (the screen validates it before sending), so anything odd is dropped.
const params = z.object({ email: z.string().optional() });

export default function ForgotPasswordRoute() {
  const raw = useLocalSearchParams<{ email?: string }>();
  const parsed = params.safeParse(raw);
  return (
    <ForgotPasswordScreen
      initialEmail={parsed.success ? (parsed.data.email ?? '') : ''}
      onSubmit={(address) => forgotPassword(api, address)}
      onSent={(address) => {
        router.push({ pathname: '/code', params: { purpose: 'recovery', email: address } });
      }}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/sign-in');
      }}
    />
  );
}

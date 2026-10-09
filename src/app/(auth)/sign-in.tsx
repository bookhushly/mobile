import { router } from 'expo-router';

import { resendConfirmation } from '@/features/auth/api/accountApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { api } from '@/shared/api/instance';

export default function SignInRoute() {
  const signIn = useAuth((s) => s.signIn);
  return (
    <SignInScreen
      onSubmit={signIn}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/welcome');
      }}
      onForgot={(email) => {
        router.push({ pathname: '/forgot-password', params: { email } });
      }}
      onCreateAccount={() => {
        router.push('/sign-up');
      }}
      onConfirmEmail={async (email) => {
        // Whatever the resend result, continue: the code screen offers resend and never leaks
        // whether the account exists.
        await resendConfirmation(api, email);
        router.push({ pathname: '/code', params: { purpose: 'confirm', email } });
      }}
    />
  );
}

import { router } from 'expo-router';
import { Linking } from 'react-native';

import { resendConfirmation, signUp } from '@/features/auth/api/accountApi';
import { SignUpScreen } from '@/features/auth/screens/SignUpScreen';
import { api } from '@/shared/api/instance';

export default function SignUpRoute() {
  const toCode = (email: string) => {
    router.push({ pathname: '/code', params: { purpose: 'signup', email } });
  };
  return (
    <SignUpScreen
      onSubmit={(input) => signUp(api, input)}
      onVerified={toCode}
      onVerifyExisting={async (email) => {
        // Whatever the resend result, continue: the code screen offers resend and never leaks
        // whether the account exists.
        await resendConfirmation(api, email);
        toCode(email);
      }}
      onSignIn={() => {
        router.replace('/sign-in');
      }}
      onOpenLink={(url) => {
        void Linking.openURL(url);
      }}
    />
  );
}

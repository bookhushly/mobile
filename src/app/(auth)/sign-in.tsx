import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function SignInRoute() {
  const signIn = useAuth((s) => s.signIn);
  return <SignInScreen onSubmit={signIn} />;
}

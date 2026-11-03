import { useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useSignInPrompt, type SignInReason } from '@/features/customer/hooks/useSignInPrompt';
import { Button, Sheet, Text, TextLink } from '@/shared/ui';

const COPY: Record<SignInReason, { title: string; body: string }> = {
  book: {
    title: 'Sign in to book',
    body: 'We keep your booking and tickets in your account. Your dates and room stay as you chose them.',
  },
  save: {
    title: 'Sign in to save',
    body: "We'll save this to your account as soon as you've signed in.",
  },
};

type Props = { onCreateAccount: () => void; onSignIn: () => void };

export function SignInPromptSheet({ onCreateAccount, onSignIn }: Props) {
  const reason = useSignInPrompt((s) => s.reason);
  const dismiss = useSignInPrompt((s) => s.dismiss);
  const proceed = useSignInPrompt((s) => s.proceed);
  // The copy stays on the sheet while it slides away.
  const [shown, setShown] = useState<SignInReason>(reason ?? 'save');
  if (reason !== null && reason !== shown) setShown(reason);
  const afterDismiss = useRef<(() => void) | null>(null);

  // iOS can't present the next screen while this modal is closing; Android has no dismiss event.
  const leaveTo = (navigate: () => void) => {
    proceed();
    if (Platform.OS === 'ios') afterDismiss.current = navigate;
    else navigate();
  };

  const copy = COPY[shown];
  return (
    <Sheet
      visible={reason !== null}
      title={copy.title}
      onClose={dismiss}
      onDismissed={() => {
        const navigate = afterDismiss.current;
        afterDismiss.current = null;
        navigate?.();
      }}
      testID="sign-in-prompt"
      footer={
        <>
          <Button
            label="Create account"
            onPress={() => {
              leaveTo(onCreateAccount);
            }}
          />
          <Button
            label="Sign in"
            variant="secondary"
            onPress={() => {
              leaveTo(onSignIn);
            }}
          />
          <TextLink label="Not now" onPress={dismiss} />
        </>
      }
    >
      <Text variant="body">{copy.body}</Text>
    </Sheet>
  );
}

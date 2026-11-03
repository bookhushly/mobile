import { Text, useAnnounce } from '@/shared/ui';

const WORDS = 'You’re signed in. Check your details, then continue.';

/** Shown once the contact fields appear after signing in on Select. Says it on arrival too. */
export function SignedInNote() {
  useAnnounce(WORDS, true);
  return (
    <Text variant="bodySm" tone="textSecondary" accessibilityLiveRegion="polite">
      {WORDS}
    </Text>
  );
}

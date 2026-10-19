import type { ClaimBlock } from '@/features/customer/hooks/useClaim';
import type { ClaimCounts } from '@/features/customer/schemas/actions';
import { maskEmail } from '@/shared/lib/maskEmail';
import { Banner } from '@/shared/ui';

export type ClaimCardKind = 'offer' | 'confirmEmail';

/**
 * Spec E4 / §3: an offer when the server reports guest bookings, a note when the email must be
 * confirmed first. Nothing while loading, after a failed check, at 0, or for `not_customer`
 * (gate and desk accounts, review focus 3).
 */
export function claimCardKind(
  counts: ClaimCounts | null,
  blocked: ClaimBlock | null,
): ClaimCardKind | null {
  if (blocked === 'emailUnverified') return 'confirmEmail';
  if (blocked !== null) return null;
  return counts !== null && counts.total > 0 ? 'offer' : null;
}

export function bookingsWord(n: number): string {
  return `${String(n)} ${n === 1 ? 'booking' : 'bookings'}`;
}

type Props = {
  kind: ClaimCardKind;
  /** The account email (shown masked). */
  email: string;
  total: number;
  onAdd: () => void;
  /** Omitted where the card is the only way on (the empty Bookings list). */
  onDismiss?: () => void;
};

const TITLE = 'Bookings made as a guest';
/** UX review U4: where to confirm (the sign-in code is the only path in the app). */
export const CONFIRM_EMAIL =
  'Confirm your email first: sign out, then sign in and follow the code we email you.';

// An offer or a note, never a result: neither is announced on mount (Task 4 review, item 1).
export function ClaimCard({ kind, email, total, onAdd, onDismiss }: Props) {
  if (kind === 'confirmEmail') {
    return (
      <Banner
        tone="info"
        testID="claim-card"
        title={TITLE}
        message={CONFIRM_EMAIL}
        onDismiss={onDismiss}
        announceOnMount={false}
      />
    );
  }
  return (
    <Banner
      tone="info"
      testID="claim-card"
      title={TITLE}
      message={`${bookingsWord(total)} made with ${maskEmail(email)} can be added to your account.`}
      action={{ label: total === 1 ? 'Add it' : 'Add them', onPress: onAdd }}
      onDismiss={onDismiss}
      announceOnMount={false}
    />
  );
}

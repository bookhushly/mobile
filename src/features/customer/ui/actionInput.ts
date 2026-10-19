import {
  REFUND_REASON_MAX,
  REVIEW_COMMENT_MAX,
  REVIEW_COMMENT_MIN,
  transferRequest,
} from '@/features/customer/schemas/actions';

// Spec E6–E8: every input is checked before any call; invalid input never reaches the server.
// Each returns the error line, or null when the input can be sent.

export function reasonError(text: string): string | null {
  const n = text.trim().length;
  if (n === 0) return 'Tell the organiser why you’re asking for a refund.';
  if (n > REFUND_REASON_MAX) return `Use ${String(REFUND_REASON_MAX)} characters or fewer.`;
  return null;
}

export function commentError(text: string): string | null {
  const n = text.trim().length;
  if (n < REVIEW_COMMENT_MIN) return `Write at least ${String(REVIEW_COMMENT_MIN)} characters.`;
  if (n > REVIEW_COMMENT_MAX) return `Use ${String(REVIEW_COMMENT_MAX)} characters or fewer.`;
  return null;
}

/** The normalised address, or why it can't be sent (`own`: this user's emails). */
export function checkEmail(
  text: string,
  own: readonly string[],
): { ok: true; email: string } | { ok: false; error: string } {
  const r = transferRequest.safeParse({ new_email: text });
  if (!r.success) return { ok: false, error: 'Enter a valid email address.' };
  const email = r.data.new_email;
  if (own.some((e) => e.trim().toLowerCase() === email)) {
    return { ok: false, error: 'That’s your own email. Enter the email of who you’re sending to.' };
  }
  return { ok: true, email };
}

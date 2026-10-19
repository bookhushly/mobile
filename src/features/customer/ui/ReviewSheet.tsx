import { useState, type ReactNode } from 'react';

import type { ReviewDone } from '@/features/customer/domain/actionOutcome';
import type { ActionState } from '@/features/customer/hooks/actionState';
import { REVIEW_COMMENT_MAX } from '@/features/customer/schemas/actions';
import { ActionDone } from '@/features/customer/ui/ActionDone';
import { commentError } from '@/features/customer/ui/actionInput';
import { reviewNotice } from '@/features/customer/ui/actionText';
import { BookingSummary } from '@/features/customer/ui/BookingSummary';
import { CharCounter } from '@/features/customer/ui/CharCounter';
import { RateLimitWait } from '@/features/customer/ui/RateLimitWait';
import { StarRating } from '@/features/customer/ui/StarRating';
import { Banner, Button, Input, Sheet, Stack, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  title: string;
  when: string;
  state: ActionState<ReviewDone>;
  onPost: (rating: number, comment: string) => void;
  onClose: () => void;
};

// Spec E8 (Turo, Peerspace, Tripadvisor): what is reviewed, five stars with a word, a comment
// with a counter, Post review. "Already reviewed" (409) is a done state, never an error.
export function ReviewSheet({ visible, title, when, state, onPost, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);
  const busy = state.kind === 'sending';
  const ratingError = tried && rating === 0 ? 'Choose a rating.' : null;
  // UX review U5: the minimum is checked when the box is left, not only on Post.
  const [blurred, setBlurred] = useState(false);
  const textError = tried || blurred ? commentError(comment) : null;

  function close() {
    if (busy) return;
    setRating(0);
    setComment('');
    setTried(false);
    setBlurred(false);
    onClose();
  }

  function post() {
    setTried(true);
    if (busy || rating === 0 || commentError(comment) !== null) return;
    onPost(rating, comment.trim());
  }

  let body: ReactNode;
  let footer: ReactNode;
  if (state.kind === 'done') {
    body =
      state.value === 'posted' ? (
        <ActionDone title="Thanks — your review is live" />
      ) : (
        <ActionDone title="Reviewed" message="You’ve already reviewed this." />
      );
    footer = <Button label="Done" onPress={close} />;
  } else {
    const notice =
      state.kind === 'idle' || state.kind === 'sending' || state.kind === 'checking'
        ? null
        : reviewNotice(state);
    body = (
      <Stack gap="s4">
        <BookingSummary title={title} when={when} />
        <Stack gap="s2">
          <StarRating value={rating} onChange={setRating} disabled={busy} />
          {ratingError !== null ? (
            <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
              {ratingError}
            </Text>
          ) : null}
        </Stack>
        <Input
          label="Your review"
          hint="At least 10 characters. Others see it on the listing."
          value={comment}
          onChangeText={setComment}
          onBlur={() => {
            if (comment !== '') setBlurred(true);
          }}
          multiline
          maxLength={REVIEW_COMMENT_MAX}
          textAlignVertical="top"
          editable={!busy}
          error={textError ?? undefined}
          testID="review-comment"
        />
        <CharCounter length={comment.length} max={REVIEW_COMMENT_MAX} />
        {notice !== null ? (
          <Banner tone={notice.tone} message={notice.message} testID="review-notice" />
        ) : null}
        {state.kind === 'rateLimited' ? (
          <RateLimitWait retryAfterSec={state.retryAfterSec} />
        ) : null}
      </Stack>
    );
    footer =
      (state.kind === 'refused' && state.reason !== 'invalid') || state.kind === 'signedOut' ? (
        <Button variant="secondary" label="Back to booking" onPress={close} />
      ) : (
        <Button label="Post review" loading={busy} onPress={post} />
      );
  }

  return (
    <Sheet
      visible={visible}
      title="Write a review"
      onClose={close}
      closeDisabled={busy}
      footer={footer}
      scroll
      testID="review-sheet"
    >
      {body}
    </Sheet>
  );
}

// What a car rental write's outcome says. Transient failures always say "try again", never a
// refusal (CLAUDE.md); a refusal names what happened and what's safe.

export const CAR_TRY_AGAIN = 'Couldn’t reach Bookhushly. Check your connection and try again.';

const REFUSED: Record<string, string> = {
  bad_request: 'Some answers need a change. Check them and try again.',
  request_not_open: 'This request isn’t taking quotes any more.',
  offer_unavailable: 'That quote isn’t available any more. Choose another one.',
  not_cancellable: 'This request can’t be cancelled now.',
  not_completable: 'The company hasn’t marked the trip done yet.',
  already_reviewed: 'You’ve already reviewed this trip.',
  forbidden: 'This request isn’t on your account.',
  not_found: 'This request wasn’t found.',
};

export function carRefusedWords(code: string): string {
  return REFUSED[code] ?? 'Something went wrong on our side. Try again in a few minutes.';
}

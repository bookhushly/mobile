import { fireEvent, render, screen } from '@testing-library/react-native';

import type { OverlayView } from '@/features/gate/domain/scanSession';
import { OutcomeOverlay } from '@/features/gate/ui/OutcomeOverlay';
import { color } from '@/shared/theme';

const NOW = Date.parse('2026-10-05T18:05:00.000Z');
const view = (outcome: OverlayView['outcome'], extraAdmitted = 0): OverlayView => ({
  id: 1,
  code: null,
  outcome,
  extraAdmitted,
});
const handlers = { onDismiss: jest.fn(), onTryAgain: jest.fn(), onSignIn: jest.fn() };
const fill = () => screen.getByTestId('outcome-overlay').props.style as { backgroundColor: string };

it.each([
  [
    {
      kind: 'admitted',
      ticketType: 'Regular',
      ticketIndex: 1,
      totalTickets: 1,
      checkedInCount: 1,
      checkedInAt: null,
    },
    'Admitted',
    color.outcome.admitted.bg,
  ],
  [
    {
      kind: 'used',
      checkedInAt: null,
      scannedBy: { kind: 'anotherScanner' },
      ticketType: null,
      replayed: false,
    },
    'Already used',
    color.outcome.used.bg,
  ],
  [{ kind: 'refused', reason: 'wrongEvent', fixable: false }, 'Refused', color.outcome.refused.bg],
  [{ kind: 'refused', reason: 'expired', fixable: true }, 'Refused', color.outcome.used.bg],
  [{ kind: 'couldntCheck', cause: 'network' }, "Couldn't check", color.outcome.retry.bg],
] as const)('%o renders title, icon and fill', async (outcome, title, bg) => {
  await render(<OutcomeOverlay view={view(outcome)} nowMs={NOW} {...handlers} />);
  expect(screen.getByText(title)).toBeTruthy();
  expect(screen.getByTestId(`outcome-icon-${title}`)).toBeTruthy();
  expect(fill().backgroundColor).toBe(bg);
});

it("couldn't check is never red", async () => {
  await render(
    <OutcomeOverlay
      view={view({ kind: 'couldntCheck', cause: 'rateLimited' })}
      nowMs={NOW}
      {...handlers}
    />,
  );
  expect(fill().backgroundColor).not.toBe(color.outcome.refused.bg);
});

it('try again and sign in call back; refusals have Done', async () => {
  const onTryAgain = jest.fn();
  const onSignIn = jest.fn();
  const onDismiss = jest.fn();
  const { rerender } = await render(
    <OutcomeOverlay
      view={view({ kind: 'couldntCheck', cause: 'timeout' })}
      nowMs={NOW}
      onDismiss={onDismiss}
      onTryAgain={onTryAgain}
      onSignIn={onSignIn}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onTryAgain).toHaveBeenCalledWith(1);
  await rerender(
    <OutcomeOverlay
      view={view({ kind: 'couldntCheck', cause: 'auth' })}
      nowMs={NOW}
      onDismiss={onDismiss}
      onTryAgain={onTryAgain}
      onSignIn={onSignIn}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in again' }));
  expect(onSignIn).toHaveBeenCalledWith();
  await rerender(
    <OutcomeOverlay
      view={view({ kind: 'refused', reason: 'notFound', fixable: false })}
      nowMs={NOW}
      onDismiss={onDismiss}
      onTryAgain={onTryAgain}
      onSignIn={onSignIn}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(onDismiss).toHaveBeenCalledWith(1);
});

it('shows the +N admitted chip', async () => {
  await render(
    <OutcomeOverlay
      view={view({ kind: 'refused', reason: 'notFound', fixable: false }, 4)}
      nowMs={NOW}
      {...handlers}
    />,
  );
  expect(screen.getByText('+4 admitted')).toBeTruthy();
});

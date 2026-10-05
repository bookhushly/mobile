import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { OverlayView } from '@/features/gate/domain/scanSession';
import { OutcomeOverlay } from '@/features/gate/ui/OutcomeOverlay';
import { color, space } from '@/shared/theme';

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

// iOS collapses an accessible element's children: no button may sit inside one.
type Node = ReturnType<typeof screen.getByTestId>;
function insideAccessibleAncestor(node: Node): boolean {
  for (let n = node.parent; n !== null; n = n.parent) {
    if (n.props.accessible === true) return true;
  }
  return false;
}

it.each([
  [{ kind: 'refused', reason: 'notFound', fixable: false }, ['Done']],
  [{ kind: 'couldntCheck', cause: 'network' }, ['Try again', 'Dismiss']],
  [{ kind: 'couldntCheck', cause: 'auth' }, ['Sign in again', 'Dismiss']],
] as const)('%o: every action is its own reachable button', async (outcome, labels) => {
  await render(<OutcomeOverlay view={view(outcome)} nowMs={NOW} {...handlers} />);
  for (const name of labels) {
    const button = screen.getByRole('button', { name });
    expect(insideAccessibleAncestor(button)).toBe(false);
  }
  expect(screen.getByTestId('outcome-overlay').props.accessible).not.toBe(true);
});

it('announces title, detail, secondary line and the +N chip as one alert', async () => {
  await render(
    <OutcomeOverlay
      view={view(
        {
          kind: 'admitted',
          ticketType: 'Regular',
          ticketIndex: 2,
          totalTickets: 3,
          checkedInCount: 2,
          checkedInAt: null,
        },
        4,
      )}
      nowMs={NOW}
      {...handlers}
    />,
  );
  const alert = screen.getByRole('alert');
  expect(alert.props.accessibilityLiveRegion).toBe('assertive');
  expect(alert.props.accessibilityLabel).toBe(
    'Admitted. Regular · ticket 2 of 3. 2 of 3 on this booking are in. +4 admitted',
  );
  expect(alert.props.onClick).toBeUndefined();
});

it('a timed overlay still dismisses on tap; a held one does not', async () => {
  const onDismiss = jest.fn();
  const admitted = {
    kind: 'admitted',
    ticketType: null,
    ticketIndex: null,
    totalTickets: null,
    checkedInCount: null,
    checkedInAt: null,
  } as const;
  const { rerender } = await render(
    <OutcomeOverlay view={view(admitted)} nowMs={NOW} {...handlers} onDismiss={onDismiss} />,
  );
  await fireEvent.press(screen.getByTestId('outcome-overlay'));
  expect(onDismiss).toHaveBeenCalledWith(1);
  onDismiss.mockClear();
  await rerender(
    <OutcomeOverlay
      view={view({ kind: 'refused', reason: 'notFound', fixable: false })}
      nowMs={NOW}
      {...handlers}
      onDismiss={onDismiss}
    />,
  );
  await fireEvent.press(screen.getByTestId('outcome-overlay'));
  expect(onDismiss).not.toHaveBeenCalled();
});

it('pins the actions to the bottom and does not scale gate text past 1.0', async () => {
  await render(
    <OutcomeOverlay
      view={view({ kind: 'refused', reason: 'wrongEvent', fixable: false })}
      nowMs={NOW}
      {...handlers}
    />,
  );
  const actions = StyleSheet.flatten(
    screen.getByTestId('outcome-actions').props.style as StyleProp<ViewStyle>,
  );
  expect(actions.marginTop).toBe('auto');
  for (const t of ['Refused', 'This ticket is for a different event', 'Done']) {
    expect(screen.getByText(t).props.maxFontSizeMultiplier).toBe(1);
  }
});

it('keeps the content clear of the notch and home indicator while the fill stays full-bleed', async () => {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <OutcomeOverlay
        view={view({ kind: 'refused', reason: 'wrongEvent', fixable: false })}
        nowMs={NOW}
        {...handlers}
      />
    </SafeAreaProvider>,
  );
  const content = StyleSheet.flatten(
    screen.getByTestId('outcome-content').props.style as StyleProp<ViewStyle>,
  );
  expect(content.paddingTop).toBe(47 + space.s7);
  expect(content.paddingBottom).toBe(34 + space.s7);
  const f = StyleSheet.flatten(
    screen.getByTestId('outcome-overlay').props.style as StyleProp<ViewStyle>,
  );
  expect(f).toMatchObject({ top: 0, bottom: 0, left: 0, right: 0 });
});

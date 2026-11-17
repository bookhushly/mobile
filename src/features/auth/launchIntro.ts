// Which route this launch first settled on, written once by the root layout while it renders,
// so the opening screen knows on its very first frame whether to show (a cold start that lands
// on Welcome) without a state round trip that would let Welcome flash first.
let launchRoute: string | null = null;
let played = false;
// Welcome has drawn beneath the intro. The intro holds the mark (identical to the splash) until
// then: building Welcome can take a second on a slow device or a dev build, and a timeline already
// running would dissolve onto nothing (recorded 2026-11-15).
let welcomeDrawn = false;
const welcomeWaiters = new Set<() => void>();

export function noteLaunchRoute(route: string): void {
  if (launchRoute === null && route !== 'loading') launchRoute = route;
}

// The opening choreography (owner's pick D, 2026-11-15), shared by the intro (which plays it) and
// Welcome (which enters as it ends). Milliseconds from the first frame.
export const INTRO = {
  /** The mark holds still, picking up from the native splash. */
  hold: 350,
  /** The mark steps left and the name slides out from behind it. */
  reveal: 420,
  /** The whole logo holds, long enough to read the name. */
  nameHold: 380,
  /** The logo lifts a little and fades. */
  markOut: 300,
  /** The violet layer starts dissolving this long after the logo starts to leave. */
  layerDelay: 120,
  layerOut: 480,
} as const;

/** When the logo starts to leave (after the hold, the reveal and the beat on the full logo). */
export const LOGO_OUT_AT = INTRO.hold + INTRO.reveal + INTRO.nameHold;

/** When Welcome's content starts rising in: as the violet layer is half gone. */
export const WELCOME_ENTERS_AT = LOGO_OUT_AT + INTRO.layerDelay + INTRO.layerOut / 2;

/** Stable for the whole launch: it opened on the sign-in screens (the intro's launch). Pure. */
export function launchLandedOnAuth(): boolean {
  return launchRoute === 'auth';
}

/** Read during render: the intro is about to play over Welcome on this launch. Pure. */
export function launchIntroPending(): boolean {
  return !played && launchRoute === 'auth';
}

/** True once per launch, and only when the launch landed on the sign-in screens. */
export function claimLaunchIntro(): boolean {
  if (played || launchRoute !== 'auth') return false;
  played = true;
  return true;
}

/** Read on Welcome's first frame: this launch's intro is playing over it (enter in step with it). */
export function welcomeUnderIntro(): boolean {
  return launchRoute === 'auth' && !welcomeDrawn;
}

/** Welcome's first layout: the intro can start. Later calls are no-ops. */
export function noteWelcomeDrawn(): void {
  if (welcomeDrawn) return;
  welcomeDrawn = true;
  for (const run of welcomeWaiters) run();
  welcomeWaiters.clear();
}

/** Runs `run` once Welcome has drawn (now, if it has). Returns the unsubscribe. */
export function whenWelcomeDrawn(run: () => void): () => void {
  if (welcomeDrawn) {
    run();
    return () => undefined;
  }
  welcomeWaiters.add(run);
  return () => {
    welcomeWaiters.delete(run);
  };
}

/** Tests only: a fresh launch. */
export function resetLaunchIntroForTests(): void {
  launchRoute = null;
  played = false;
  welcomeDrawn = false;
  welcomeWaiters.clear();
}

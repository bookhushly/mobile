import {
  claimLaunchIntro,
  noteLaunchRoute,
  resetLaunchIntroForTests,
} from '@/features/auth/launchIntro';

beforeEach(resetLaunchIntroForTests);

it('plays once when the launch lands on the sign-in screens', () => {
  noteLaunchRoute('loading');
  noteLaunchRoute('auth');
  expect(claimLaunchIntro()).toBe(true);
  expect(claimLaunchIntro()).toBe(false);
});

it('never plays when the launch landed elsewhere, even if sign-in opens later', () => {
  noteLaunchRoute('customer');
  noteLaunchRoute('auth');
  expect(claimLaunchIntro()).toBe(false);
});

it('waits for a settled route', () => {
  expect(claimLaunchIntro()).toBe(false);
});

it('Welcome rises in as the violet layer is half gone, after the name has been read', () => {
  const { INTRO, LOGO_OUT_AT, WELCOME_ENTERS_AT } = jest.requireActual<
    typeof import('@/features/auth/launchIntro')
  >('@/features/auth/launchIntro');
  // The mark holds, the name slides out, the full logo holds, then it leaves.
  expect(LOGO_OUT_AT).toBe(INTRO.hold + INTRO.reveal + INTRO.nameHold);
  expect(WELCOME_ENTERS_AT).toBeGreaterThan(LOGO_OUT_AT + INTRO.layerDelay);
  expect(WELCOME_ENTERS_AT).toBeLessThan(LOGO_OUT_AT + INTRO.layerDelay + INTRO.layerOut);
});

it('tells Welcome the intro is coming before the intro claims it, then not again', () => {
  const { launchIntroPending } = jest.requireActual<typeof import('@/features/auth/launchIntro')>(
    '@/features/auth/launchIntro',
  );
  noteLaunchRoute('auth');
  expect(launchIntroPending()).toBe(true);
  claimLaunchIntro();
  expect(launchIntroPending()).toBe(false);
});

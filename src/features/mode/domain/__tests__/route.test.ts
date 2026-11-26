import {
  authScreensAllowed,
  resolveRoute,
  shouldDropPending,
  type AppRoute,
  type AuthKind,
  type ModeState,
} from '@/features/mode/domain/route';

const single: ModeState = {
  status: 'ready',
  resolution: { kind: 'modes', modes: ['gate'], defaultMode: 'gate' },
};

describe('resolveRoute', () => {
  it('update gate wins over everything', () => {
    expect(
      resolveRoute({
        versionOk: false,
        auth: 'signedIn',
        mode: single,
        chosenMode: null,
        recovery: false,
        browsing: false,
      }),
    ).toBe('update');
  });
  it('shows loading while auth or mode is loading', () => {
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'loading',
        mode: { status: 'idle' },
        chosenMode: null,
        recovery: false,
        browsing: false,
      }),
    ).toBe('loading');
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: { status: 'loading' },
        chosenMode: null,
        recovery: false,
        browsing: false,
      }),
    ).toBe('loading');
  });
  it('signed out -> auth', () => {
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedOut',
        mode: { status: 'idle' },
        chosenMode: null,
        recovery: false,
        browsing: false,
      }),
    ).toBe('auth');
  });
  it('mode lookup error -> modeError, never customer', () => {
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: { status: 'error' },
        chosenMode: null,
        recovery: false,
        browsing: false,
      }),
    ).toBe('modeError');
  });
  it('web-only accounts', () => {
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: { status: 'ready', resolution: { kind: 'webOnly' } },
        chosenMode: null,
        recovery: false,
        browsing: false,
      }),
    ).toBe('webOnly');
  });
  it('uses the chosen mode if available, else the default', () => {
    const m: ModeState = {
      status: 'ready',
      resolution: { kind: 'modes', modes: ['gate', 'customer'], defaultMode: 'gate' },
    };
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: m,
        chosenMode: 'customer',
        recovery: false,
        browsing: false,
      }),
    ).toBe('customer');
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: m,
        chosenMode: 'receptionist',
        recovery: false,
        browsing: false,
      }),
    ).toBe('gate');
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: m,
        chosenMode: null,
        recovery: false,
        browsing: false,
      }),
    ).toBe('gate');
  });
  it('a password reset in progress keeps the sign-in screens in front even when signed in', () => {
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: single,
        chosenMode: null,
        recovery: true,
        browsing: false,
      }),
    ).toBe('auth');
  });
  it('an unsupported version still wins over recovery', () => {
    expect(
      resolveRoute({
        versionOk: false,
        auth: 'signedIn',
        mode: single,
        chosenMode: null,
        recovery: true,
        browsing: false,
      }),
    ).toBe('update');
  });

  describe('browsing without an account', () => {
    const base = { versionOk: true, chosenMode: null, recovery: false };
    it('browsing keeps a signed-out person in customer', () => {
      expect(
        resolveRoute({ ...base, auth: 'signedOut', mode: { status: 'idle' }, browsing: true }),
      ).toBe('customer');
    });
    it('waits for the stored choice before showing Welcome', () => {
      expect(
        resolveRoute({ ...base, auth: 'signedOut', mode: { status: 'idle' }, browsing: null }),
      ).toBe('loading');
    });
    it('holds customer while a browsing mode loads, so the stack survives sign-in', () => {
      expect(
        resolveRoute({ ...base, auth: 'signedIn', mode: { status: 'loading' }, browsing: true }),
      ).toBe('customer');
      expect(
        resolveRoute({ ...base, auth: 'signedIn', mode: { status: 'loading' }, browsing: false }),
      ).toBe('loading');
    });
    it('a staff mode wins once known, even while browsing', () => {
      expect(resolveRoute({ ...base, auth: 'signedIn', mode: single, browsing: true })).toBe(
        'gate',
      );
    });
    it('recovery wins over browsing', () => {
      expect(
        resolveRoute({
          ...base,
          recovery: true,
          auth: 'signedIn',
          mode: { status: 'idle' },
          browsing: true,
        }),
      ).toBe('auth');
    });
    it('a reset started while browsing lands back in customer once the password is saved', () => {
      // Mid-reset the mode lookup is off (idle); saving clears recovery and it starts loading.
      expect(
        resolveRoute({
          ...base,
          recovery: true,
          auth: 'signedIn',
          mode: { status: 'idle' },
          browsing: true,
        }),
      ).toBe('auth');
      expect(
        resolveRoute({ ...base, auth: 'signedIn', mode: { status: 'idle' }, browsing: true }),
      ).toBe('customer');
      expect(
        resolveRoute({ ...base, auth: 'signedIn', mode: { status: 'loading' }, browsing: true }),
      ).toBe('customer');
    });
    it('the update gate wins over browsing', () => {
      expect(
        resolveRoute({
          ...base,
          versionOk: false,
          auth: 'signedOut',
          mode: { status: 'idle' },
          browsing: true,
        }),
      ).toBe('update');
    });
    it('auth screens open over browsing only while signed out', () => {
      expect(authScreensAllowed('customer', 'signedOut')).toBe(true);
      expect(authScreensAllowed('customer', 'signedIn')).toBe(false);
      expect(authScreensAllowed('auth', 'signedOut')).toBe(true);
      expect(authScreensAllowed('auth', 'signedIn')).toBe(true);
      expect(authScreensAllowed('loading', 'signedOut')).toBe(false);
    });
    it.each<[AppRoute, AuthKind, boolean]>([
      ['gate', 'signedIn', true],
      ['receptionist', 'signedIn', true],
      ['vendor', 'signedIn', true],
      ['webOnly', 'signedIn', true],
      ['customer', 'signedIn', false],
      ['customer', 'signedOut', false],
      ['loading', 'signedIn', false],
      ['modeError', 'signedIn', false],
      ['auth', 'signedIn', false],
    ])('pending save on route %s while %s: dropped = %s', (route, auth, dropped) => {
      expect(shouldDropPending(route, auth)).toBe(dropped);
    });
  });
});

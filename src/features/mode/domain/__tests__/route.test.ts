import { resolveRoute, type ModeState } from '@/features/mode/domain/route';

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
      }),
    ).toBe('loading');
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: { status: 'loading' },
        chosenMode: null,
        recovery: false,
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
      }),
    ).toBe('customer');
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: m,
        chosenMode: 'receptionist',
        recovery: false,
      }),
    ).toBe('gate');
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: m,
        chosenMode: null,
        recovery: false,
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
      }),
    ).toBe('update');
  });
});

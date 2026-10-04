import { resolveRoute, type ModeState } from '@/features/mode/domain/route';

const single: ModeState = {
  status: 'ready',
  resolution: { kind: 'modes', modes: ['gate'], defaultMode: 'gate' },
};

describe('resolveRoute', () => {
  it('update gate wins over everything', () => {
    expect(resolveRoute({ versionOk: false, auth: 'signedIn', mode: single, chosenMode: null })).toBe(
      'update',
    );
  });
  it('shows loading while auth or mode is loading', () => {
    expect(
      resolveRoute({ versionOk: true, auth: 'loading', mode: { status: 'idle' }, chosenMode: null }),
    ).toBe('loading');
    expect(
      resolveRoute({
        versionOk: true,
        auth: 'signedIn',
        mode: { status: 'loading' },
        chosenMode: null,
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
      }),
    ).toBe('webOnly');
  });
  it('uses the chosen mode if available, else the default', () => {
    const m: ModeState = {
      status: 'ready',
      resolution: { kind: 'modes', modes: ['gate', 'customer'], defaultMode: 'gate' },
    };
    expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: m, chosenMode: 'customer' })).toBe(
      'customer',
    );
    expect(
      resolveRoute({ versionOk: true, auth: 'signedIn', mode: m, chosenMode: 'receptionist' }),
    ).toBe('gate');
    expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: m, chosenMode: null })).toBe(
      'gate',
    );
  });
});

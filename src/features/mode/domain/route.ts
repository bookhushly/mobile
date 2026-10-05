import type { Mode, ModeResolution } from './resolveMode';

export type ModeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; resolution: ModeResolution };

export type AuthKind = 'loading' | 'signedOut' | 'signedIn';

export type AppRoute =
  'loading' | 'update' | 'auth' | 'modeError' | 'webOnly' | 'gate' | 'receptionist' | 'customer';

type Input = { versionOk: boolean; auth: AuthKind; mode: ModeState; chosenMode: Mode | null };

export function resolveRoute(i: Input): AppRoute {
  if (!i.versionOk) return 'update';
  if (i.auth === 'loading') return 'loading';
  if (i.auth === 'signedOut') return 'auth';
  switch (i.mode.status) {
    case 'idle':
    case 'loading':
      return 'loading';
    case 'error':
      return 'modeError';
    case 'ready': {
      const r = i.mode.resolution;
      if (r.kind === 'webOnly') return 'webOnly';
      return i.chosenMode && r.modes.includes(i.chosenMode) ? i.chosenMode : r.defaultMode;
    }
  }
}

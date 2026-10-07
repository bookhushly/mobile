export type CueKind = 'success' | 'warning' | 'error' | 'retry';
export type HapticKind = 'success' | 'warning' | 'error' | 'light';

export const MUTE_KEY = 'bh.gate.muted';

export function hapticFor(cue: CueKind): HapticKind {
  switch (cue) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'retry':
      return 'light';
  }
}

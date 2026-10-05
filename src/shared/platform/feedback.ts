import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { hapticFor, MUTE_KEY, type CueKind, type HapticKind } from '@/shared/lib/feedbackPlan';
import type { KeyValue } from '@/shared/lib/kv';

import { plainKv } from './storage';

const SOURCES: Record<CueKind, number> = {
  success: require('../../../assets/sounds/gate-success.wav') as number,
  warning: require('../../../assets/sounds/gate-warning.wav') as number,
  error: require('../../../assets/sounds/gate-error.wav') as number,
  retry: require('../../../assets/sounds/gate-retry.wav') as number,
};
const ORDER: CueKind[] = ['success', 'warning', 'error', 'retry'];

function haptic(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export type Feedback = {
  load(): Promise<void>;
  cue(kind: CueKind): void;
  isMuted(): boolean;
  setMuted(muted: boolean): Promise<void>;
  release(): void;
};

// iOS haptics can be silent while the camera runs — colour + icon + text + sound carry the result.
export function createFeedback(deps: { kv?: KeyValue } = {}): Feedback {
  const kv = deps.kv ?? plainKv;
  const players = new Map<CueKind, AudioPlayer>();
  let muted = false;

  return {
    async load() {
      try {
        muted = (await kv.get(MUTE_KEY)) === '1';
      } catch {
        muted = false;
      }
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
      for (const k of ORDER) if (!players.has(k)) players.set(k, createAudioPlayer(SOURCES[k]));
    },
    cue(kind) {
      void haptic(hapticFor(kind)).catch(() => undefined);
      if (muted) return;
      const p = players.get(kind);
      if (!p) return;
      void p.seekTo(0).catch(() => undefined);
      p.play();
    },
    isMuted: () => muted,
    async setMuted(next) {
      muted = next;
      await kv.set(MUTE_KEY, next ? '1' : '0');
    },
    release() {
      for (const p of players.values()) p.remove();
      players.clear();
    },
  };
}

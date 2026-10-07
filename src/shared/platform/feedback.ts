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
  let released = false;
  // A call, not the variable: load() must re-read it after each await (release() may run meanwhile).
  const isReleased = () => released;

  function removeAll() {
    for (const p of players.values()) p.remove();
    players.clear();
  }

  return {
    // Never rejects: a sound setup failure must not leave the shift silent or unhandled.
    async load() {
      if (isReleased()) return;
      try {
        muted = (await kv.get(MUTE_KEY)) === '1';
      } catch {
        muted = false;
      }
      try {
        await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
      } catch {
        // Players still work with the default audio mode.
      }
      if (isReleased()) return;
      try {
        for (const k of ORDER) if (!players.has(k)) players.set(k, createAudioPlayer(SOURCES[k]));
      } catch {
        // Haptics, colour, icon and text still carry the outcome.
      }
      // A release() that raced this load must not leave players behind.
      if (isReleased()) removeAll();
    },
    cue(kind) {
      void haptic(hapticFor(kind)).catch(() => undefined);
      if (muted) return;
      const p = players.get(kind);
      if (!p) return;
      // Play after the seek, so a repeat cue starts from the beginning, not the old position.
      void p
        .seekTo(0)
        .then(() => {
          p.play();
        })
        .catch(() => undefined);
    },
    isMuted: () => muted,
    async setMuted(next) {
      muted = next;
      await kv.set(MUTE_KEY, next ? '1' : '0');
    },
    release() {
      released = true;
      removeAll();
    },
  };
}

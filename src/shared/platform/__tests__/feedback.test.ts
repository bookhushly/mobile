import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { memoryKv } from '@/shared/lib/kv';
import { createFeedback } from '@/shared/platform/feedback';

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    seekTo: jest.fn(() => Promise.resolve()),
    play: jest.fn(),
    remove: jest.fn(),
  })),
}));
jest.mock('@/shared/platform/storage', () => ({ plainKv: {} }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

type MockPlayer = { play: jest.Mock; seekTo: jest.Mock; remove: jest.Mock };
const players = () =>
  (createAudioPlayer as jest.Mock).mock.results.map((r) => r.value as MockPlayer);

beforeEach(() => {
  jest.clearAllMocks();
});

it('respects silent mode and preloads four sounds', async () => {
  const f = createFeedback({ kv: memoryKv() });
  await f.load();
  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }),
  );
  expect(createAudioPlayer).toHaveBeenCalledTimes(4);
});

const flush = () => new Promise<void>((r) => setImmediate(r));

it('plays the sound from the start (after the seek) and fires the haptic', async () => {
  const f = createFeedback({ kv: memoryKv() });
  await f.load();
  f.cue('error');
  const p = players()[2];
  expect(p?.seekTo).toHaveBeenCalledWith(0);
  expect(p?.play).not.toHaveBeenCalled();
  await flush();
  expect(p?.play).toHaveBeenCalled();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
});

it('still creates the players when the audio mode cannot be set', async () => {
  (setAudioModeAsync as jest.Mock).mockImplementationOnce(() =>
    Promise.reject(new Error('audio session busy')),
  );
  const f = createFeedback({ kv: memoryKv() });
  await expect(f.load()).resolves.toBeUndefined();
  expect(createAudioPlayer).toHaveBeenCalledTimes(4);
  f.cue('success');
  await flush();
  expect(players()[0]?.play).toHaveBeenCalled();
});

it('a release during load leaves no players behind', async () => {
  let finishMode: () => void = () => undefined;
  (setAudioModeAsync as jest.Mock).mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        finishMode = r;
      }),
  );
  const f = createFeedback({ kv: memoryKv() });
  const loading = f.load();
  await flush();
  f.release();
  finishMode();
  await loading;
  const made = players();
  expect(made.every((p) => p.remove.mock.calls.length > 0)).toBe(true);
  f.cue('success');
  await flush();
  expect(made.some((p) => p.play.mock.calls.length > 0)).toBe(false);
});

it('load after release is a no-op', async () => {
  const f = createFeedback({ kv: memoryKv() });
  f.release();
  await f.load();
  expect(createAudioPlayer).not.toHaveBeenCalled();
});

it('mute silences sound but keeps haptics, and persists', async () => {
  const kv = memoryKv();
  const f = createFeedback({ kv });
  await f.load();
  await f.setMuted(true);
  f.cue('success');
  expect(players()[0]?.play).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  const g = createFeedback({ kv });
  await g.load();
  expect(g.isMuted()).toBe(true);
});

it('retry uses a light impact', async () => {
  const f = createFeedback({ kv: memoryKv() });
  await f.load();
  f.cue('retry');
  expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
});

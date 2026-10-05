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

it('plays the sound from the start and fires the haptic', async () => {
  const f = createFeedback({ kv: memoryKv() });
  await f.load();
  f.cue('error');
  const p = players()[2];
  expect(p?.seekTo).toHaveBeenCalledWith(0);
  expect(p?.play).toHaveBeenCalled();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
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

import { statusPill } from '@/features/gate/domain/statusPill';
import { EMPTY_SYNC, type SyncStatus } from '@/features/gate/domain/syncLine';

const NOW = Date.parse('2026-10-08T18:00:00Z');
const list = { count: 1240, syncedAt: NOW - 2 * 60_000 };
const s = (p: Partial<SyncStatus>): SyncStatus => ({ ...EMPTY_SYNC, ...p });

describe('statusPill priority', () => {
  it('blocked beats everything', () => {
    expect(statusPill(s({ blocked: true, attention: 2, mode: 'offline' }), NOW)).toMatchObject({
      kind: 'blocked',
      tone: 'danger',
      text: 'Removed from this event — admissions can’t be sent',
      tab: 'synced',
    });
    expect(statusPill(s({ blocked: true, pending: 3 }), NOW)).toMatchObject({
      text: 'Removed from this event — admissions can’t be sent',
      tab: 'toSync',
    });
  });
  it('attention and clock never hide admissions waiting to sync', () => {
    expect(statusPill(s({ attention: 1, pending: 3 }), NOW)).toMatchObject({
      kind: 'attention',
      tone: 'warning',
      text: '1 needs attention · 3 to sync',
      tab: 'attention',
      announceKey: 'attention:1',
    });
    expect(
      statusPill(s({ clock: { suspect: true, checkedAgoMs: 0 }, pending: 2 }), NOW),
    ).toMatchObject({
      kind: 'clock',
      tone: 'warning',
      text: 'Phone time changed — connect to re-check · 2 to sync',
      tab: 'toSync',
      announceKey: 'clock',
    });
    expect(
      statusPill(s({ clock: { suspect: false, checkedAgoMs: 14 * 3_600_000 }, pending: 1 }), NOW)
        .text,
    ).toBe('Time last checked 14 h ago · 1 to sync');
    expect(statusPill(s({ attention: 2 }), NOW).text).toBe('2 need attention');
    expect(statusPill(s({ clock: { suspect: true, checkedAgoMs: 0 } }), NOW).text).toBe(
      'Phone time changed — connect to re-check',
    );
  });
  it('needs attention beats the clock and offline', () => {
    expect(
      statusPill(
        s({ attention: 1, mode: 'offline', clock: { suspect: true, checkedAgoMs: 0 } }),
        NOW,
      ),
    ).toMatchObject({
      kind: 'attention',
      tone: 'warning',
      text: '1 needs attention',
      tab: 'attention',
    });
    expect(statusPill(s({ attention: 3 }), NOW).text).toBe('3 need attention');
  });
  it('a changed clock beats syncing', () => {
    expect(
      statusPill(s({ clock: { suspect: true, checkedAgoMs: 0 }, syncing: true, pending: 2 }), NOW),
    ).toMatchObject({
      kind: 'clock',
      tone: 'warning',
      text: 'Phone time changed — connect to re-check · 2 to sync',
      tab: 'toSync',
    });
  });
  it('a clock not checked for over 12 h warns', () => {
    expect(
      statusPill(s({ clock: { suspect: false, checkedAgoMs: 14 * 3_600_000 }, list }), NOW).text,
    ).toBe('Time last checked 14 h ago');
    expect(
      statusPill(s({ clock: { suspect: false, checkedAgoMs: 3_600_000 }, list }), NOW).kind,
    ).toBe('online');
  });
  it('syncing shows the count', () => {
    expect(statusPill(s({ syncing: true, pending: 2, list }), NOW)).toMatchObject({
      kind: 'syncing',
      tone: 'info',
      text: 'Syncing 2…',
      tab: 'toSync',
    });
    expect(statusPill(s({ syncing: true, pending: 0, list }), NOW).kind).toBe('online');
  });
  it('offline with and without things to sync, and with no list', () => {
    expect(statusPill(s({ mode: 'offline', list, pending: 3 }), NOW)).toMatchObject({
      kind: 'offline',
      tone: 'neutral',
      text: 'Offline · 3 to sync',
      tab: 'toSync',
    });
    expect(statusPill(s({ mode: 'offline', list }), NOW)).toMatchObject({
      text: 'Offline · deciding on this phone',
      tab: 'synced',
    });
    expect(statusPill(s({ mode: 'offline' }), NOW).text).toBe('Offline · no offline list');
  });
  it('downloading only before the first list', () => {
    expect(statusPill(s({ download: { done: 4000, total: 12500 } }), NOW)).toMatchObject({
      kind: 'downloading',
      tone: 'info',
      text: 'Downloading list 4,000 of 12,500',
    });
    expect(statusPill(s({ download: { done: 10, total: 20 }, list }), NOW).kind).toBe('online');
  });
  it('online shows list freshness and anything to sync', () => {
    expect(statusPill(s({ list }), NOW)).toMatchObject({
      kind: 'online',
      tone: 'success',
      text: 'Online · list 2 min ago',
      tab: 'synced',
    });
    expect(statusPill(s({ list, pending: 1 }), NOW)).toMatchObject({
      text: 'Online · list 2 min ago · 1 to sync',
      tab: 'toSync',
    });
    expect(statusPill(s({}), NOW).text).toBe('Online · no offline list yet');
  });
});

describe('announceKey', () => {
  it('does not change when only the time text changes', () => {
    const a = statusPill(s({ list }), NOW);
    const b = statusPill(s({ list }), NOW + 60_000);
    expect(a.text).not.toBe(b.text);
    expect(a.announceKey).toBe(b.announceKey);
  });
  it('changes when the count to sync changes offline', () => {
    expect(statusPill(s({ mode: 'offline', list, pending: 1 }), NOW).announceKey).not.toBe(
      statusPill(s({ mode: 'offline', list, pending: 2 }), NOW).announceKey,
    );
  });
  it('changes when the syncing count or the attention count changes', () => {
    expect(statusPill(s({ syncing: true, pending: 1 }), NOW).announceKey).not.toBe(
      statusPill(s({ syncing: true, pending: 2 }), NOW).announceKey,
    );
    expect(statusPill(s({ attention: 1 }), NOW).announceKey).not.toBe(
      statusPill(s({ attention: 2 }), NOW).announceKey,
    );
  });
  it('differs between kinds', () => {
    const kinds = [
      statusPill(s({ blocked: true }), NOW),
      statusPill(s({ attention: 1 }), NOW),
      statusPill(s({ clock: { suspect: true, checkedAgoMs: 0 } }), NOW),
      statusPill(s({ syncing: true, pending: 1 }), NOW),
      statusPill(s({ mode: 'offline' }), NOW),
      statusPill(s({ download: { done: 1, total: 2 } }), NOW),
      statusPill(s({ list }), NOW),
    ].map((v) => v.announceKey);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

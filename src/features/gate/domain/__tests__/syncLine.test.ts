import {
  attentionLine,
  EMPTY_SYNC,
  groupDigits,
  syncLine,
  type SyncStatus,
} from '@/features/gate/domain/syncLine';

const NOW = Date.parse('2026-10-07T18:10:00Z');
const s = (over: Partial<SyncStatus>): SyncStatus => ({ ...EMPTY_SYNC, ...over });
const LIST = { count: 1240, syncedAt: NOW - 2 * 60_000 };

describe('syncLine', () => {
  it('online with a list', () => {
    expect(syncLine(s({ list: LIST }), NOW)).toEqual({
      text: 'Online · offline list 1,240 · 2 min ago',
      warning: null,
      tone: 'normal',
    });
  });
  it('online with admissions waiting', () => {
    expect(syncLine(s({ list: LIST, pending: 3 }), NOW).text).toBe(
      'Online · offline list 1,240 · 2 min ago · 3 to sync',
    );
  });
  it('syncing', () => {
    expect(syncLine(s({ list: LIST, pending: 3, syncing: true }), NOW).text).toBe('Syncing 3…');
  });
  it('offline, deciding on this phone', () => {
    expect(syncLine(s({ mode: 'offline', list: LIST, pending: 3 }), NOW)).toEqual({
      text: 'Offline · deciding on this phone · 3 to sync',
      warning: null,
      tone: 'offline',
    });
  });
  it('offline with no list', () => {
    expect(syncLine(s({ mode: 'offline' }), NOW)).toMatchObject({
      text: 'Offline · no offline list on this phone',
      tone: 'problem',
    });
  });
  it('first download progress', () => {
    expect(syncLine(s({ download: { done: 4000, total: 12500 } }), NOW).text).toBe(
      'Downloading offline list 4,000 of 12,500',
    );
  });
  it('removed from the event', () => {
    expect(syncLine(s({ list: LIST, blocked: true }), NOW)).toMatchObject({
      text: 'Removed from this event — offline admissions can’t be sent',
      tone: 'problem',
    });
  });
  it('clock warnings', () => {
    expect(
      syncLine(s({ list: LIST, clock: { suspect: true, checkedAgoMs: 0 } }), NOW).warning,
    ).toBe('Phone time changed — connect to re-check');
    expect(
      syncLine(s({ list: LIST, clock: { suspect: false, checkedAgoMs: 14 * 3_600_000 } }), NOW)
        .warning,
    ).toBe('Time last checked 14 h ago');
    expect(
      syncLine(s({ list: LIST, clock: { suspect: false, checkedAgoMs: 3_600_000 } }), NOW).warning,
    ).toBeNull();
  });
});

describe('attentionLine', () => {
  it.each([
    [
      { state: 'duplicate', result: { scanned_by: 'Ada', checked_in_at: '2026-10-07T17:55:00Z' } },
      /^Also admitted by Ada at \d\d:\d\d$/,
    ],
    [
      { state: 'suspect', result: { code: 'invalid_code' } },
      /^The server says this code was not valid$/,
    ],
    [
      { state: 'rejected', result: { code: 'not_confirmed' } },
      /^Not accepted — booking not confirmed$/,
    ],
    [
      { state: 'rejected', result: { code: 'bad_timestamp' } },
      /^Not accepted — the phone’s time was wrong$/,
    ],
    [{ state: 'blocked', result: null }, /^Not sent — you were removed from this event$/],
    [{ state: 'error', result: null }, /^Not sent — the server refused the request$/],
  ] as const)('%j', (item, re) => {
    expect(attentionLine(item, NOW)).toMatch(re);
  });
});

it('groups digits', () => {
  expect(groupDigits(999)).toBe('999');
  expect(groupDigits(12500)).toBe('12,500');
  expect(groupDigits(1234567)).toBe('1,234,567');
});

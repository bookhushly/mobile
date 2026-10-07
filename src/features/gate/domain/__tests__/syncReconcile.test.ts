import { backoffMs, reconcile } from '@/features/gate/domain/syncReconcile';

describe('reconcile', () => {
  it('ok is synced', () => {
    expect(reconcile({ client_seq: 1, ok: true, code: 'ok', checked_in_at: 'x' })).toEqual({
      state: 'synced',
      result: { code: 'ok', checked_in_at: 'x' },
    });
  });
  it('already used by this account is a harmless retry', () => {
    expect(reconcile({ client_seq: 1, ok: false, code: 'already_checked_in', by_me: true }).state).toBe('synced');
  });
  it('already used by someone else is a duplicate with their name and time', () => {
    expect(
      reconcile({ client_seq: 1, ok: false, code: 'already_checked_in', by_me: false, scanned_by: 'Ada', checked_in_at: 't' }),
    ).toEqual({ state: 'duplicate', result: { code: 'already_checked_in', scanned_by: 'Ada', checked_in_at: 't' } });
  });
  it('an unknown by_me is surfaced as a duplicate, not guessed away', () => {
    expect(reconcile({ client_seq: 1, ok: false, code: 'already_checked_in', by_me: null }).state).toBe('duplicate');
  });
  it.each(['invalid_code', 'expired_code'])('%s on re-verify is suspect', (code) => {
    expect(reconcile({ client_seq: 1, ok: false, code }).state).toBe('suspect');
  });
  it.each(['not_found', 'wrong_event', 'not_confirmed', 'static_not_allowed', 'bad_timestamp', 'booking_qr', 'bad_item', 'forbidden', 'something_new'])(
    '%s is rejected with its code',
    (code) => {
      expect(reconcile({ client_seq: 1, ok: false, code })).toEqual({ state: 'rejected', result: { code } });
    },
  );
});

describe('backoffMs', () => {
  it('doubles from 2 s, caps at 60 s, jitters within the upper half', () => {
    expect(backoffMs(0, () => 1)).toBe(2_000);
    expect(backoffMs(0, () => 0)).toBe(1_000);
    expect(backoffMs(3, () => 1)).toBe(16_000);
    expect(backoffMs(10, () => 1)).toBe(60_000);
  });
});

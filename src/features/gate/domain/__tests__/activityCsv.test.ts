import { ACTIVITY_HEADER, activityCsv, type ActivityRow } from '@/features/gate/domain/activityCsv';

const row = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  ticketId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  ticketType: 'VIP',
  ticketIndex: 2,
  scannedAt: '2026-10-07T18:00:00.000Z',
  mode: 'offline_override',
  state: 'duplicate',
  result: { scanned_by: 'Ada', checked_in_at: '2026-10-07T17:55:00Z' },
  reason: 'Bought at the door',
  approvedBy: 'Tunde',
  ...over,
});

describe('activityCsv', () => {
  it('has exactly the agreed columns', () => {
    expect(ACTIVITY_HEADER).toEqual([
      'ticket_ref', 'ticket_type', 'ticket_number', 'scanned_at', 'mode', 'state', 'server_note', 'reason', 'approved_by',
    ]);
  });
  it('writes one row per item with a short ticket reference', () => {
    const lines = activityCsv([row()]).split('\r\n');
    const line = lines[1];
    if (typeof line !== 'string') throw new Error('Expected string at lines[1]');

    const columns = line.split(',');
    const serverNote = columns[6] ?? '';
    const time = serverNote.slice('Also admitted by Ada at '.length);

    expect(line).toBe(
      '3f2504e0,VIP,2,2026-10-07T18:00:00.000Z,offline_override,duplicate,Also admitted by Ada at ' +
        time +
        ',Bought at the door,Tunde',
    );
  });
  it('never contains a full ticket id', () => {
    expect(activityCsv([row()])).not.toContain('3f2504e0-4f89');
  });
  it('a synced item has an empty server note', () => {
    const line = activityCsv([row({ state: 'synced', result: null, reason: null, approvedBy: null, mode: 'offline' })]).split('\r\n')[1];
    expect(line).toBe('3f2504e0,VIP,2,2026-10-07T18:00:00.000Z,offline,synced,,,');
  });
});

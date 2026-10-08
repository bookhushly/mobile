import { attentionLine, groupDigits } from '@/features/gate/domain/syncLine';

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
    expect(attentionLine(item)).toMatch(re);
  });
});

it('groups digits', () => {
  expect(groupDigits(999)).toBe('999');
  expect(groupDigits(12500)).toBe('12,500');
  expect(groupDigits(1234567)).toBe('1,234,567');
});

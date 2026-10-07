import { toCsv } from '@/shared/lib/csv';

describe('toCsv', () => {
  it('joins with commas and CRLF, quoting only when needed', () => {
    expect(toCsv(['a', 'b'], [['x', 1], [null, 'y']])).toBe('a,b\r\nx,1\r\n,y\r\n');
  });
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(toCsv(['a'], [['O, "Ada"\nObi']])).toBe('a\r\n"O, ""Ada""\nObi"\r\n');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(toCsv(['a'], [['=HYPERLINK("x")'], ['+1'], ['-2'], ['@SUM'], ['\tx']])).toBe(
      'a\r\n"\'=HYPERLINK(""x"")"\r\n\'+1\r\n\'-2\r\n\'@SUM\r\n\'\tx\r\n',
    );
  });
});

import { MAX_CHARS, plainText } from '@/features/customer/domain/plainText';

describe('plainText', () => {
  it('returns null for nothing to show', () => {
    expect(plainText(null)).toBeNull();
    expect(plainText('   ')).toBeNull();
    expect(plainText('<p> </p><br/>')).toBeNull();
  });

  it('keeps plain text as written, trimmed', () => {
    expect(plainText('  A quiet room by the lagoon.  ')).toBe('A quiet room by the lagoon.');
  });

  it('strips tags and keeps paragraph and line breaks', () => {
    expect(plainText('<p>Pool <b>and</b> gym.</p><p>Free <i>wifi</i>.<br>Parking</p>')).toBe(
      'Pool and gym.\nFree wifi.\nParking',
    );
  });

  it('turns list items into bullet lines', () => {
    expect(plainText('<ul><li>Pool</li><li>Gym</li></ul>')).toBe('• Pool\n• Gym');
  });

  it('drops script and style blocks with their contents, and comments', () => {
    expect(
      plainText('Hi<script>alert("x")</script><style>p{color:red}</style><!-- note -->there'),
    ).toBe('Hithere');
  });

  it('drops tags with attributes, including ones split over lines', () => {
    expect(plainText('<a href="https://x.test"\n onclick="evil()">Book</a> now')).toBe('Book now');
  });

  it('leaves a lone < that is not a tag', () => {
    expect(plainText('Rooms < ₦50,000 & up')).toBe('Rooms < ₦50,000 & up');
  });

  it('decodes common entities once (never twice)', () => {
    expect(plainText('Tom &amp; Jerry&#39;s &quot;spot&quot; &lt;3 &nbsp;ok')).toBe(
      'Tom & Jerry\'s "spot" <3 ok',
    );
    expect(plainText('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
    expect(plainText('&rsquo;&ldquo;&rdquo;&ndash;&mdash;&hellip;&#8358;&#x20A6;')).toBe(
      '’“”–—…₦₦',
    );
  });

  it('decoded angle brackets stay text, never become tags again', () => {
    expect(plainText('&lt;script&gt;x&lt;/script&gt;')).toBe('<script>x</script>');
  });

  it('leaves unknown or invalid entities as written', () => {
    expect(plainText('&bogus; &#xD800; &#99999999;')).toBe('&bogus; &#xD800; &#99999999;');
  });

  it('collapses runs of spaces and blank lines', () => {
    expect(plainText('One   two\t three\r\n\r\n\r\n\r\nFour')).toBe('One two three\n\nFour');
  });

  it('keeps <br class> breaks but not words that start with br', () => {
    expect(plainText('a<br class="x">b <brand>c')).toBe('a\nb c');
  });

  it('drops an unclosed comment or script to the end, as a browser would', () => {
    expect(plainText('Hi <!-- never closed <b>x</b>')).toBe('Hi');
    expect(plainText('Hi <script>alert(1) <b>x</b>')).toBe('Hi');
    expect(plainText('A<STYLE>p{}</style >B')).toBe('AB');
  });

  it('cuts very long text by code points, without splitting an emoji', () => {
    const out = plainText('😀'.repeat(MAX_CHARS + 5)) ?? '';
    expect(Array.from(out)).toHaveLength(MAX_CHARS + 1);
    expect(out.endsWith('😀…')).toBe(true);
    expect(plainText('a'.repeat(MAX_CHARS))).toHaveLength(MAX_CHARS);
  });
});

// Review 7 (1): customer reviews and vendor text are untrusted; no input may stall the JS thread.
describe('plainText on hostile input', () => {
  const KB100 = 100_000;
  it.each([
    ['unclosed tags', '<a'],
    ['unclosed comments', '<!--'],
    ['unclosed scripts', '<script'],
    ['unclosed styles', '<style '],
    ['unclosed line breaks', '<br'],
    ['unclosed list items', '<li '],
    ['entity starts', '&#'],
    ['long entity names', '&abcdefghijk'],
  ])('finishes 100 KB of %s in under 50 ms', (_, unit) => {
    const input = unit.repeat(Math.ceil(KB100 / unit.length));
    const t0 = performance.now();
    plainText(input);
    expect(performance.now() - t0).toBeLessThan(50);
  });
});

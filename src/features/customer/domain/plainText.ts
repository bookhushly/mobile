// Vendor descriptions and policies may hold HTML from the web editor. The app never renders HTML
// (no WebView): this turns it into plain text. Pure.

const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
};

function codePoint(n: number): string | null {
  const valid = Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff);
  return valid ? String.fromCodePoint(n) : null;
}

// One pass, so "&amp;lt;" becomes "&lt;" and never "<". Bounded entity bodies keep it linear.
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{1,10});/gi, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return codePoint(parseInt(body.slice(2), 16)) ?? whole;
    }
    if (body.startsWith('#')) return codePoint(parseInt(body.slice(1), 10)) ?? whole;
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Longest text cleaned, in code points; anything longer is cut with "…". */
export const MAX_CHARS = 20_000;

function capped(raw: string): string {
  // Slicing code units first bounds the work; then cut on a code-point boundary.
  const points = Array.from(raw.slice(0, MAX_CHARS * 2));
  return points.length > MAX_CHARS || raw.length > MAX_CHARS * 2
    ? `${points.slice(0, MAX_CHARS).join('')}…`
    : raw;
}

// Comments, scripts and styles are dropped with forward-only scans (never a regex that can
// rescan the rest of the string from every start): an unclosed one drops the rest, as a browser
// would. Linear time on any input, so a hostile review or description can't freeze the screen.
function dropComments(s: string): string {
  let out = '';
  let at = 0;
  for (;;) {
    const open = s.indexOf('<!--', at);
    if (open < 0) return out + s.slice(at);
    out += s.slice(at, open);
    const close = s.indexOf('-->', open + 4);
    if (close < 0) return out;
    at = close + 3;
  }
}

function dropScripts(s: string): string {
  const open = /<(script|style)\b/gi;
  let out = '';
  let at = 0;
  for (;;) {
    open.lastIndex = at;
    const m = open.exec(s);
    if (m === null) return out + s.slice(at);
    out += s.slice(at, m.index);
    const close = new RegExp(`</${m[1] ?? ''}\\s*>`, 'gi');
    close.lastIndex = open.lastIndex;
    const c = close.exec(s);
    if (c === null) return out;
    at = close.lastIndex;
  }
}

/** Line breaks normalised, spaces collapsed per line, blank runs at most one empty line. */
function tidy(s: string): string | null {
  const text = s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text === '' ? null : text;
}

/** Short text with no tag or entity in it skips the HTML passes (perf review P6). */
const SHORT = 2_000;

/** HTML or plain text → plain text with line breaks kept; null when nothing is left. */
export function plainText(raw: string | null): string | null {
  if (raw === null) return null;
  if (raw.length <= SHORT && !raw.includes('<') && !raw.includes('&')) return tidy(raw);
  // `[^<>]*` stops each attempt at the next "<", so a run of unclosed "<a" stays linear.
  const stripped = dropScripts(dropComments(capped(raw)))
    .replace(/<br\b[^<>]*>/gi, '\n')
    .replace(/<li\b[^<>]*>/gi, '\n• ')
    .replace(/<\/li\s*>/gi, '')
    .replace(/<\/(p|div|ul|ol|h[1-6]|tr|blockquote)\s*>/gi, '\n')
    // Only real tags (a letter, / or ! after <): "Rooms < ₦50,000" stays.
    .replace(/<\/?[a-z!][^<>]*>/gi, '');
  // Decoded last: "&lt;b&gt;" is shown as text, never parsed as a tag.
  return tidy(decode(stripped));
}

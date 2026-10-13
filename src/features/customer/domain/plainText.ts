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

// One pass, so "&amp;lt;" becomes "&lt;" and never "<".
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return codePoint(parseInt(body.slice(2), 16)) ?? whole;
    }
    if (body.startsWith('#')) return codePoint(parseInt(body.slice(1), 10)) ?? whole;
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** HTML or plain text → plain text with line breaks kept; null when nothing is left. */
export function plainText(raw: string | null): string | null {
  if (raw === null) return null;
  const stripped = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/li\s*>/gi, '')
    .replace(/<\/(p|div|ul|ol|h[1-6]|tr|blockquote)\s*>/gi, '\n')
    // Only real tags (a letter, / or ! after <): "Rooms < ₦50,000" stays.
    .replace(/<\/?[a-z!][^>]*>/gi, '');
  // Decoded last: "&lt;b&gt;" is shown as text, never parsed as a tag.
  const text = decode(stripped)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text === '' ? null : text;
}

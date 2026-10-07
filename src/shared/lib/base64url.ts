const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const INDEX = new Map(Array.from(ALPHABET).map((c, i) => [c, i] as const));
const CHARS = /^[A-Za-z0-9_-]+$/;

const at = (i: number) => ALPHABET.charAt(i & 63);

/** Unpadded base64url. */
export function encodeBase64url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += at(n >> 18) + at(n >> 12) + at(n >> 6) + at(n);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] ?? 0) << 16;
    out += at(n >> 18) + at(n >> 12);
  } else if (rest === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += at(n >> 18) + at(n >> 12) + at(n >> 6);
  }
  return out;
}

/**
 * Strict unpadded base64url, like the web's decodeExact: null unless re-encoding gives the same
 * text (no padding, no spare bits) and, when `length` is given, exactly that many bytes.
 */
export function decodeBase64url(text: string, length?: number): Uint8Array | null {
  if (!CHARS.test(text) || text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 6) / 8));
  let buf = 0;
  let bits = 0;
  let j = 0;
  for (const c of text) {
    buf = (buf << 6) | (INDEX.get(c) ?? 0);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (buf >> bits) & 255;
      buf &= (1 << bits) - 1;
    }
  }
  if (length !== undefined && out.length !== length) return null;
  return encodeBase64url(out) === text ? out : null;
}

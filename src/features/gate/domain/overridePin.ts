import { scryptAsync } from '@noble/hashes/scrypt.js';

import { decodeBase64url } from '@/shared/lib/base64url';

export type PinVerifier = {
  N: number;
  r: number;
  p: number;
  dkLen: 32;
  salt: Uint8Array;
  hash: Uint8Array;
};

const PIN_RE = /^[0-9]{6}$/;
const isPow2 = (n: number) => Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
const num = (o: object, k: string): number | null =>
  k in o && typeof (o as Record<string, unknown>)[k] === 'number'
    ? ((o as Record<string, unknown>)[k] as number)
    : null;
const str = (o: object, k: string): string | null =>
  k in o && typeof (o as Record<string, unknown>)[k] === 'string'
    ? ((o as Record<string, unknown>)[k] as string)
    : null;

/**
 * The roster's `override` object → a verifier, or null when there is no usable override.
 * Bounds stop a tampered or broken roster from making the phone hash for minutes or run out of
 * memory (web spec: N=8192 r=8 p=1 dk_len=32 today).
 */
export function parseVerifier(raw: unknown): PinVerifier | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.enabled !== true || o.alg !== 'scrypt') return null;
  const N = num(raw, 'N');
  const r = num(raw, 'r');
  const p = num(raw, 'p');
  const dk = num(raw, 'dk_len');
  if (N === null || r === null || p === null || dk !== 32) return null;
  if (!isPow2(N) || N > 32_768 || !Number.isInteger(r) || r < 1 || r > 16) return null;
  if (!Number.isInteger(p) || p < 1 || p > 4) return null;
  const saltText = str(raw, 'salt');
  const hashText = str(raw, 'hash');
  const salt = saltText === null ? null : decodeBase64url(saltText, 16);
  const hash = hashText === null ? null : decodeBase64url(hashText, 32);
  if (salt === null || hash === null) return null;
  return { N, r, p, dkLen: 32, salt, hash };
}

export const isPinShape = (pin: string): boolean => PIN_RE.test(pin);

// Compare every byte so the time taken doesn't depend on where the first difference is.
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** FR-3.15: checked on the phone; the server can't check it (web spec decision 5). */
export async function verifyPin(pin: string, v: PinVerifier): Promise<boolean> {
  if (!isPinShape(pin)) return false;
  const derived = await scryptAsync(pin, v.salt, { N: v.N, r: v.r, p: v.p, dkLen: v.dkLen });
  return sameBytes(derived, v.hash);
}

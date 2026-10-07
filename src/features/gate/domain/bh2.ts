import { ed25519 } from '@noble/curves/ed25519.js';

import { decodeBase64url } from '@/shared/lib/base64url';

// Mirrors web lib/ticket-signing.js (verified 2026-10-07). The phone only verifies; it never signs.
export const BH2_STEP_MS = 30_000;

export type TicketKey = { kid: string; publicKey: string };

export type Bh2Parsed = {
  kid: string;
  ticketId: string;
  step: number;
  signature: Uint8Array;
  message: Uint8Array;
};

export type Bh2Check =
  | { ok: true; ticketId: string; kid: string; step: number }
  | { ok: false; reason: 'malformed' | 'unknown_key' | 'bad_signature' };

const KID_RE = /^[a-z0-9]{1,8}$/;
const STEP_RE = /^[0-9a-z]{1,10}$/;

function uuidOf(b: Uint8Array): string {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function parseBh2(token: string): Bh2Parsed | null {
  const parts = token.trim().split('.');
  if (parts.length !== 5 || parts[0] !== 'BH2') return null;
  const [, kid = '', id = '', stepRaw = '', sigRaw = ''] = parts;
  const idBytes = decodeBase64url(id, 16);
  const signature = decodeBase64url(sigRaw, 64);
  if (!KID_RE.test(kid) || idBytes === null || signature === null || !STEP_RE.test(stepRaw)) {
    return null;
  }
  const step = parseInt(stepRaw, 36);
  // One signature, one spelling: "0xqka2" and "xqka2" are the same number.
  if (step.toString(36) !== stepRaw) return null;
  const ticketId = uuidOf(idBytes);
  // The signed step is the decimal number, not the base36 text in the token.
  const message = new TextEncoder().encode(`bh2:${kid}:${ticketId}:${String(step)}`);
  return { kid, ticketId, step, signature, message };
}

export function verifyBh2(token: string, keys: readonly TicketKey[]): Bh2Check {
  const p = parseBh2(token);
  if (p === null) return { ok: false, reason: 'malformed' };
  const key = keys.find((k) => k.kid === p.kid);
  const publicKey = key === undefined ? null : decodeBase64url(key.publicKey, 32);
  if (publicKey === null) return { ok: false, reason: 'unknown_key' };
  let valid = false;
  try {
    // zip215: false = strict RFC 8032, matching the server's OpenSSL verify.
    valid = ed25519.verify(p.signature, p.message, publicKey, { zip215: false });
  } catch {
    valid = false;
  }
  return valid
    ? { ok: true, ticketId: p.ticketId, kid: p.kid, step: p.step }
    : { ok: false, reason: 'bad_signature' };
}

export const stepAt = (ms: number): number => Math.floor(ms / BH2_STEP_MS);

export const stepInWindow = (step: number, nowMs: number, tolerance = 1): boolean =>
  Math.abs(stepAt(nowMs) - step) <= tolerance;

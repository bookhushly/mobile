export type RuleId = 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';

// Must equal the server (web lib/auth/password.js): 5 rules + a 72-byte bcrypt cap.
export const RULES: readonly { id: RuleId; label: string }[] = [
  { id: 'length', label: 'At least 8 characters' },
  { id: 'uppercase', label: 'An upper-case letter' },
  { id: 'lowercase', label: 'A lower-case letter' },
  { id: 'number', label: 'A number' },
  { id: 'special', label: 'One of @$!%*?&' },
];

const MAX_BYTES = 72;

function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function passwordRules(pw: string): {
  met: Record<RuleId, boolean>;
  tooLong: boolean;
  ok: boolean;
} {
  const met: Record<RuleId, boolean> = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[@$!%*?&]/.test(pw),
  };
  const tooLong = utf8Bytes(pw) > MAX_BYTES;
  return { met, tooLong, ok: !tooLong && Object.values(met).every(Boolean) };
}

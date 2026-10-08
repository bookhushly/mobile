import { RULES, type RuleId } from './passwordRules';

export type FieldErrors = { name?: string; email?: string; password?: string };

const RULE_HINT: Record<RuleId, string> = {
  length: 'at least 8 characters',
  uppercase: 'an upper-case letter',
  lowercase: 'a lower-case letter',
  number: 'a number',
  special: 'one of @$!%*?&',
};

function isRuleId(r: string): r is RuleId {
  return RULES.some((x) => x.id === r);
}

// `reason` is the server's comma-joined list of failed rule ids, or `too_long` / `policy`.
function passwordMessage(reason: string): string {
  if (reason === 'too_long') return 'That password is too long';
  if (reason === 'policy') return 'Choose a stronger password';
  const ids = reason.split(',').filter(isRuleId);
  if (ids.length === 0) return 'Choose a stronger password';
  const parts = ids.map((id) => RULE_HINT[id]);
  const last = parts[parts.length - 1] ?? '';
  const list = parts.length === 1 ? last : `${parts.slice(0, -1).join(', ')} and ${last}`;
  return `Use ${list}`;
}

export function fieldMessages(fields: Record<string, string> | undefined): FieldErrors {
  if (fields === undefined) return {};
  const out: FieldErrors = {};
  if (fields.name !== undefined) {
    out.name = fields.name === 'too_long' ? 'Use 100 characters or fewer' : 'Enter your name';
  }
  if (fields.email !== undefined) {
    out.email = fields.email === 'required' ? 'Enter your email' : 'Enter a valid email address';
  }
  if (fields.password !== undefined) out.password = passwordMessage(fields.password);
  return out;
}

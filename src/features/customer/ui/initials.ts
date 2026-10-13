/** "Ada Lovelace" → "AL", "Ada" → "A"; no name → the email's first letter; else "". */
export function initials(name: string | null, email: string): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '');
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  if (first !== undefined)
    return `${first.charAt(0)}${last === undefined ? '' : last.charAt(0)}`.toUpperCase();
  return email.trim().charAt(0).toUpperCase();
}

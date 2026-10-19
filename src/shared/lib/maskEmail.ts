// a•••e@gmail.com — enough to recognise the address on a shared screen. Always masks (security
// review S4): a short local part keeps only its first letter, and text without an "@" keeps only
// its first character.
export function maskEmail(email: string): string {
  if (email === '') return '';
  const at = email.indexOf('@');
  if (at < 0) return `${email[0] ?? ''}•••`;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0] ?? ''}•••${domain}`;
  return `${local[0] ?? ''}•••${local[local.length - 1] ?? ''}${domain}`;
}

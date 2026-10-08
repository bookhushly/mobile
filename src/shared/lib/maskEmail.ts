// a•••e@gmail.com — enough to recognise the address on a shared screen.
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length === 1) return email;
  if (local.length === 2) return `${local[0] ?? ''}•${domain}`;
  return `${local[0] ?? ''}•••${local[local.length - 1] ?? ''}${domain}`;
}

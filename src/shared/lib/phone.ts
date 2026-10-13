export type PhoneParse = { ok: true; e164: string } | { ok: false };

const SEPARATORS = /[\s\-.()]/g;
const NATIONAL = /^[789]\d{9}$/;

// Accepts +234…, 234…, 0… or a bare 10-digit national number. The national number is 10 digits
// starting 7, 8 or 9 (Nigerian mobile ranges).
export function parseNigerianPhone(raw: string): PhoneParse {
  const s = raw.replace(SEPARATORS, '');
  let national: string;
  if (s.startsWith('+234')) national = s.slice(4);
  else if (s.startsWith('234') && s.length === 13) national = s.slice(3);
  else if (s.startsWith('0')) national = s.slice(1);
  else national = s;
  return NATIONAL.test(national) ? { ok: true, e164: `+234${national}` } : { ok: false };
}

// '+2348031234567' → '0803 123 4567'. Anything else is returned unchanged.
export function formatNigerianPhone(e164: string): string {
  if (!/^\+234\d{10}$/.test(e164)) return e164;
  const n = e164.slice(4);
  return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

export const NIGERIAN_STATES: readonly string[] = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
];

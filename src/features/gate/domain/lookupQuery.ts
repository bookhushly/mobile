export type LookupQuery = { kind: 'phoneTail' | 'phoneHead' | 'name'; value: string };

const DIGITS = /^[0-9]+$/;

// FR-3.7. The roster holds masked phones like "0803••••210": only the first 4 and the last 3 digits
// are visible, so 2–3 digits search the tail and 4 digits the head.
export function parseLookup(input: string): LookupQuery | null {
  const value = input.trim().replace(/\s+/g, ' ');
  if (DIGITS.test(value)) {
    if (value.length === 2 || value.length === 3) return { kind: 'phoneTail', value };
    if (value.length === 4) return { kind: 'phoneHead', value };
    return null;
  }
  const letters = (value.match(/\p{L}/gu) || []).length;
  return letters >= 2 ? { kind: 'name', value } : null;
}

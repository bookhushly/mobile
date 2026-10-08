type Cell = string | number | null;

// Spreadsheet apps run cells starting with these as formulas (CSV injection).
const FORMULA = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

function cell(v: Cell): string {
  if (v === null) return '';
  let s = typeof v === 'number' ? String(v) : v;
  if (typeof v === 'string' && FORMULA.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with CRLF line ends, safe to open in a spreadsheet. */
export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

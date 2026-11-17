// Dates relative to "now", so tonight's event is always tonight and past stays are always past.
// Nigeria is UTC+1 all year (no daylight saving).

const DAY_MS = 86_400_000;
const LAGOS_OFFSET_MS = 3_600_000;

function lagosParts(ms: number): { y: number; m: number; d: number } {
  const t = new Date(ms + LAGOS_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in Lagos, `offset` days from today. */
export function day(offset: number): string {
  const { y, m, d } = lagosParts(Date.now() + offset * DAY_MS);
  return `${String(y)}-${pad(m)}-${pad(d)}`;
}

/** A timestamptz for `offset` days from today at hh:mm Lagos time. */
export function at(offset: number, hhmm: string): string {
  return `${day(offset)}T${hhmm}:00+01:00`;
}

/** An instant `minutes` from now (negative for the past), as ISO. */
export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** A deterministic UUID for sample row `n` (version 4 layout, so validators accept it). */
export function uid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

const STAYS = [
  '1566073771259-6a8506099945',
  '1582719478250-c89cae4dc85b',
  '1542314831-068cd1dbfeeb',
  '1551882547-ff40c63fe5fa',
  '1520250497591-112f2f40a3f4',
  '1571896349842-33c89424de2d',
  '1501117716987-c8c394bb29df',
  '1522708323590-d24dbb6b0267',
  '1502672260266-1c1ef2d93688',
  '1493809842364-78817add7ffb',
  '1524758631624-e2822e304c36',
  '1505693416388-ac5ce068fe85',
  '1590490360182-c33d57733427',
  '1611892440504-42a792e24d32',
];
const EVENTS = [
  '1540039155733-5bb30b53aa14',
  '1501281668745-f7f57925c3b4',
  '1514525253161-7a46d19cd819',
  '1470229722913-7c0e2dbbafd3',
  '1492684223066-81342ee5ff30',
  '1415201364774-f6f0bb35f28f',
];

/** A stable Unsplash photo for `seed`: stays for seeds starting h/r/a, events otherwise. */
export function photo(seed: string): string {
  const pool = /^[hra]\d/.test(seed) ? STAYS : EVENTS;
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return `https://images.unsplash.com/photo-${pool[n % pool.length] ?? ''}?w=1200&q=70`;
}

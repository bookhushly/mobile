import { formatNaira } from '@/shared/lib/formatNaira';
import type { IsoDate } from '@/shared/lib/lagosDay';

import type { OpenRequest, PhotoKey } from './today';

// The vendor's side of a request for a quote (plan slice 3). The server re-checks every rule here
// (web spec 2026-11-25 §4): the app checks only so the vendor hears about a mistake before sending.

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

export type MyOffer = { id: string; amount: number; status: OfferStatus; sentAt: string };

export type VendorRequest = OpenRequest & { myOffer: MyOffer | null };

export type FactIcon = 'package' | 'truck' | 'car' | 'users' | 'shield' | 'clock' | 'note';

/** One request in full: what was asked, never the customer's contact details. */
export type RequestDetail = VendorRequest & {
  from: string;
  to: string | null;
  start: { label: string; date: IsoDate; time: string | null };
  end: { label: string; value: string; detail: string | null } | null;
  facts: { icon: FactIcon; title: string; detail: string | null }[];
  /** The customer's own words, if they left any. */
  note: string | null;
};

/** A vehicle the vendor can put on a quote (their fleet, managed on the web). */
export type Vehicle = { id: string; name: string; detail: string; photo: PhotoKey };

export type RequestTab = 'new' | 'quoted' | 'won';

const isOpen = (r: OpenRequest, nowMs: number) => Date.parse(r.closesAt) > nowMs;

/** New: open and not quoted (a withdrawn quote counts as not quoted). Quoted: you sent one and it
 *  wasn't chosen yet, or the customer went elsewhere. Won: yours was chosen. */
export function splitRequests(
  list: readonly VendorRequest[],
  nowMs: number,
): Record<RequestTab, VendorRequest[]> {
  const out: Record<RequestTab, VendorRequest[]> = { new: [], quoted: [], won: [] };
  for (const r of list) {
    const s = r.myOffer?.status ?? null;
    if (s === 'accepted') out.won.push(r);
    else if (s === 'pending' || s === 'rejected' || s === 'expired') out.quoted.push(r);
    else if (isOpen(r, nowMs)) out.new.push(r);
  }
  out.new.sort((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt));
  return out;
}

export function offerLine(o: MyOffer): string {
  const amount = formatNaira(o.amount);
  switch (o.status) {
    case 'pending':
      return `Your quote ${amount} · waiting for the customer`;
    case 'accepted':
      return `Chosen · ${amount}`;
    case 'rejected':
      return `Not chosen · ${amount}`;
    case 'expired':
      return `Expired before they chose · ${amount}`;
    case 'withdrawn':
      return `You withdrew ${amount}`;
  }
}

export const QUOTE_MIN = 1_000;
export const QUOTE_MAX = 100_000_000;
export const QUOTE_MESSAGE_MAX = 1_000;
/** A quote stays open this long unless the customer chooses or the vendor withdraws it (web). */
export const QUOTE_OPEN_HOURS = 48;

/** Typed naira: null when blank, NaN when it isn't a whole number. */
export function parseAmount(raw: string): number | null {
  const t = raw.replace(/[,\s]/g, '');
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

/** What's wrong with the quote as typed, in words for the vendor; null when it can be sent. */
export function quoteProblem(rawAmount: string, message: string): string | null {
  const n = parseAmount(rawAmount);
  if (n === null) return 'Enter your price';
  if (Number.isNaN(n)) return 'Enter a whole amount in naira';
  if (n < QUOTE_MIN) return `The lowest quote is ${formatNaira(QUOTE_MIN)}`;
  if (n > QUOTE_MAX) return `The highest quote is ${formatNaira(QUOTE_MAX)}`;
  if (message.trim().length > QUOTE_MESSAGE_MAX) return 'Keep the message under 1,000 characters';
  return null;
}

/** Bookhushly's fee and what the vendor keeps. The rate comes from the server. */
export function quoteBreakdown(amount: number, feeRate: number): { fee: number; receive: number } {
  const fee = Math.round(amount * feeRate);
  return { fee, receive: amount - fee };
}

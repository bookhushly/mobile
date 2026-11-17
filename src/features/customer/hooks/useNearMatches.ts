import type { Category, Filters } from '@/features/customer/domain/discover';
import { cardOf, type ListingCardModel } from '@/features/customer/domain/listingCard';
import {
  MAX_RAILS,
  nearMatchPlan,
  type NearMatch,
  type Where,
} from '@/features/customer/domain/nearMatches';
import { useListingsRail } from '@/features/customer/hooks/useListings';
import { RAIL_MAX } from '@/features/customer/ui/Rail';

export type NearMatchRow = {
  match: NearMatch;
  cards: readonly ListingCardModel[];
  loading: boolean;
  failed: boolean;
};

export type NearMatchesState = {
  rows: readonly NearMatchRow[];
  /** Some loosened search found something to show. */
  found: boolean;
  /** Every loosened search has answered. */
  settled: boolean;
  /** Some loosened search failed (and none has anything to show instead). */
  failed: boolean;
  retry: () => void;
};

// The hooks run in fixed slots, one per possible rail, so their number never changes between
// renders. Unused slots don't fetch.
const SLOTS = MAX_RAILS;

/**
 * The closest-match searches for a search that found nothing or little, with what each found.
 * Listings already shown above are never offered again. Lets Results say only what's true: "Here's
 * what's closest" only once something is, a retry when a search failed, and a way out when
 * nothing turned up (UX review, 2026-11-17).
 */
export function useNearMatches(
  cat: Category,
  where: Where,
  filters: Filters,
  exclude: ReadonlySet<string>,
  nowMs: number,
  enabled: boolean,
): NearMatchesState {
  const plan = nearMatchPlan(cat, where, filters);
  const slot = (i: number) => plan[i] ?? null;
  const s0 = slot(0);
  const s1 = slot(1);
  const s2 = slot(2);
  const fallback = { category: cat, where, filters };
  const q0 = useListingsRail(
    (s0 ?? fallback).category,
    (s0 ?? fallback).where,
    (s0 ?? fallback).filters,
    { enabled: enabled && s0 !== null },
  );
  const q1 = useListingsRail(
    (s1 ?? fallback).category,
    (s1 ?? fallback).where,
    (s1 ?? fallback).filters,
    { enabled: enabled && s1 !== null },
  );
  const q2 = useListingsRail(
    (s2 ?? fallback).category,
    (s2 ?? fallback).where,
    (s2 ?? fallback).filters,
    { enabled: enabled && s2 !== null },
  );
  const queries = [q0, q1, q2].slice(0, Math.min(plan.length, SLOTS));

  const rows: NearMatchRow[] = plan.slice(0, SLOTS).map((match, i) => {
    const q = queries[i];
    const cards = (q?.items ?? [])
      .map((item) => cardOf(match.category, item, nowMs))
      .filter((c) => !exclude.has(`${c.kind}:${c.id}`))
      .slice(0, RAIL_MAX);
    return { match, cards, loading: q?.loading ?? false, failed: q?.failed ?? false };
  });
  const found = rows.some((r) => !r.loading && !r.failed && r.cards.length > 0);
  return {
    rows,
    found,
    settled: rows.every((r) => !r.loading),
    failed: !found && rows.some((r) => r.failed),
    retry: () => {
      for (const q of queries) if (q.failed) void q.refetch();
    },
  };
}

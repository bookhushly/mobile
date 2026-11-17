import type { Filters } from '@/features/customer/domain/discover';
import {
  activeFilters,
  nearMatchPlan,
  withoutFilter,
} from '@/features/customer/domain/nearMatches';

const NONE: Filters = { sort: 'newest' };
const PH = { q: '', city: 'Port Harcourt' };

describe('activeFilters', () => {
  it('names each filter that narrows the list, in words a guest reads', () => {
    const f: Filters = {
      sort: 'price_asc',
      priceMax: 50000,
      minRating: 4,
      breakfastIncluded: true,
      guests: 3,
      amenities: ['wifi', 'waves'],
    };
    expect(activeFilters('hotels', f).map((a) => a.label)).toEqual([
      'Under ₦50,000',
      'Rated 4+',
      'Breakfast included',
      '3 guests',
      'Wi-Fi',
      'Pool',
    ]);
  });

  it('reads a price range both ways, and the sort is never a filter', () => {
    expect(activeFilters('hotels', { sort: 'top_rated' })).toEqual([]);
    expect(activeFilters('hotels', { sort: 'newest', priceMin: 50000 })[0]?.label).toBe(
      '₦50,000 and up',
    );
    expect(
      activeFilters('hotels', { sort: 'newest', priceMin: 50000, priceMax: 100000 })[0]?.label,
    ).toBe('₦50,000–₦100,000');
  });

  it('covers apartments and events', () => {
    expect(
      activeFilters('serviced_apartments', { sort: 'newest', bedrooms: 2, furnished: true }).map(
        (a) => a.label,
      ),
    ).toEqual(['2 bedrooms', 'Furnished']);
    expect(activeFilters('events', { sort: 'newest', eventDate: 'weekend' })[0]?.label).toBe(
      'This weekend',
    );
  });

  it('agrees with the filter count', () => {
    const f: Filters = { sort: 'newest', certified: true, amenities: ['tv'], generator24h: true };
    expect(activeFilters('hotels', f)).toHaveLength(3);
  });
});

describe('withoutFilter', () => {
  it('drops just that one filter and keeps the rest', () => {
    const f: Filters = { sort: 'newest', priceMax: 50000, amenities: ['wifi', 'waves'] };
    expect(withoutFilter(f, 'amenity:wifi')).toEqual({
      sort: 'newest',
      priceMax: 50000,
      amenities: ['waves'],
    });
    expect(withoutFilter(f, 'price')).toEqual({ sort: 'newest', amenities: ['wifi', 'waves'] });
  });
});

describe('nearMatchPlan', () => {
  it('with a place and filters: the place without filters, the filters elsewhere, then other kinds there (three at most)', () => {
    const f: Filters = { sort: 'newest', amenities: ['wifi'] };
    expect(nearMatchPlan('hotels', PH, f)).toEqual([
      { reason: 'samePlaceNoFilters', category: 'hotels', where: PH, filters: NONE },
      { reason: 'filtersElsewhere', category: 'hotels', where: { q: '' }, filters: f },
      { reason: 'otherKind', category: 'serviced_apartments', where: PH, filters: NONE },
    ]);
  });

  it('with only a place: other kinds there, then this kind anywhere', () => {
    expect(nearMatchPlan('hotels', PH, NONE).map((m) => [m.reason, m.category])).toEqual([
      ['otherKind', 'serviced_apartments'],
      ['otherKind', 'events'],
      ['anywhere', 'hotels'],
    ]);
  });

  it('with only words searched: this kind anywhere', () => {
    expect(nearMatchPlan('events', { q: 'jazz' }, NONE)).toEqual([
      { reason: 'anywhere', category: 'events', where: { q: '' }, filters: NONE },
    ]);
  });

  it('with nothing asked at all: the other kinds', () => {
    expect(nearMatchPlan('events', { q: '' }, NONE).map((m) => m.category)).toEqual([
      'hotels',
      'serviced_apartments',
    ]);
  });

  it('keeps the sort but never the filters when loosening', () => {
    const plan = nearMatchPlan('hotels', PH, { sort: 'price_asc', minRating: 4 });
    expect(plan[0]?.filters).toEqual({ sort: 'price_asc' });
  });
});

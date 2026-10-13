import {
  createRecentSearches,
  recentSearches,
  RECENT_INDEX_KEY,
  RECENT_MAX,
  recentKey,
  type RecentSearch,
} from '@/features/customer/offline/recentSearches';
import { memoryKv } from '@/shared/lib/kv';
import { runAlwaysWipes } from '@/shared/lib/signOutGuard';

// The default instance binds native storage; back it with memory instead.
jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));
const mockKv = jest.requireMock<{ plainKv: ReturnType<typeof memoryKv> }>(
  '@/shared/platform/storage',
).plainKv;

const text = (q: string, category: RecentSearch['category'] = 'hotels'): RecentSearch => ({
  label: q,
  category,
  q,
});

describe('recent searches', () => {
  it('keys per user under bh.recent.<userId>', async () => {
    const kv = memoryKv();
    const recent = createRecentSearches(kv);
    await recent.add('u1', text('Lekki'));
    expect(recentKey('u1')).toBe('bh.recent.u1');
    expect(Object.keys(kv.dump())).toEqual(expect.arrayContaining(['bh.recent.u1']));
    expect(await recent.get('u1')).toEqual([text('Lekki')]);
    expect(await recent.get('u2')).toEqual([]);
  });

  it('newest first, a repeat moves to the top (same category and place), capped at 8', async () => {
    const recent = createRecentSearches(memoryKv());
    for (let i = 0; i < 10; i += 1) await recent.add('u1', text(`q${String(i)}`));
    await recent.add('u1', text('q5'));
    await recent.add('u1', text('q5', 'events'));
    const got = await recent.get('u1');
    expect(RECENT_MAX).toBe(8);
    expect(got).toHaveLength(8);
    expect(got.slice(0, 3)).toEqual([text('q5', 'events'), text('q5'), text('q9')]);
    expect(got.filter((e) => e.q === 'q5' && e.category === 'hotels')).toHaveLength(1);
  });

  it('stores search text sanitised and ignores an empty search', async () => {
    const recent = createRecentSearches(memoryKv());
    await recent.add('u1', {
      label: 'Lagos, Lekki (Phase 1)',
      category: 'hotels',
      q: ' Lagos, Lekki (Phase 1) ',
    });
    await recent.add('u1', { label: '', category: 'hotels', q: ' ( ) ' });
    expect(await recent.get('u1')).toEqual([
      { label: 'Lagos, Lekki (Phase 1)', category: 'hotels', q: 'Lagos Lekki Phase 1' },
    ]);
  });

  it('a place entry keeps its state or city', async () => {
    const recent = createRecentSearches(memoryKv());
    const abuja: RecentSearch = { label: 'Abuja', category: 'events', state: 'FCT' };
    await recent.add('u1', abuja);
    await recent.add('u1', abuja);
    expect(await recent.get('u1')).toEqual([abuja]);
  });

  it('removes one entry', async () => {
    const recent = createRecentSearches(memoryKv());
    await recent.add('u1', text('a'));
    await recent.add('u1', text('b'));
    await recent.remove('u1', text('a'));
    expect(await recent.get('u1')).toEqual([text('b')]);
  });

  it('a corrupt or foreign value reads as empty', async () => {
    const kv = memoryKv();
    await kv.set('bh.recent.u1', '{not json');
    await kv.set('bh.recent.u2', JSON.stringify([{ label: 1 }]));
    const recent = createRecentSearches(kv);
    expect(await recent.get('u1')).toEqual([]);
    expect(await recent.get('u2')).toEqual([]);
  });

  it('clear wipes every user’s list and the index', async () => {
    const kv = memoryKv();
    const recent = createRecentSearches(kv);
    await recent.add('u1', text('a'));
    await recent.add('u2', text('b'));
    await recent.clear();
    expect(kv.dump()).toEqual({});
    expect(RECENT_INDEX_KEY).not.toMatch(/^bh\.recent\./);
  });

  it('a guarded add writes only while the guard still says yes, checked in the write queue', async () => {
    const kv = memoryKv();
    const recent = createRecentSearches(kv);
    await recent.add('u1', text('a'), () => Promise.resolve(true));
    await recent.add('u1', text('b'), () => Promise.resolve(false));
    expect(await recent.get('u1')).toEqual([text('a')]);
    // Signed out between the tap and the write: the clear runs, then the late add is dropped.
    let signedIn = true;
    const late = recent.add('u1', text('c'), () => Promise.resolve(signedIn));
    signedIn = false;
    const wipe = recent.clear();
    await Promise.all([late, wipe]);
    expect(kv.dump()).toEqual({});
  });

  it('a guard that throws counts as signed out', async () => {
    const kv = memoryKv();
    const recent = createRecentSearches(kv);
    await recent.add('u1', text('a'), () => Promise.reject(new Error('keychain')));
    expect(kv.dump()).toEqual({});
  });

  it('the default instance is wiped on every sign-out', async () => {
    await recentSearches.add('u1', text('Lekki'));
    expect(Object.keys(mockKv.dump())).not.toHaveLength(0);
    await runAlwaysWipes();
    expect(mockKv.dump()).toEqual({});
  });
});

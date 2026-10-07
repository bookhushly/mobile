import { loadScannableEvents, type ScannerDb } from '@/shared/api/scannableEvents';

const okRes = (data: unknown) => Promise.resolve({ data, error: null });
const errRes = (status: number) => Promise.resolve({ data: null, error: { status } });

const L1 = '11111111-1111-4111-8111-111111111111';
const L2 = '22222222-2222-4222-8222-222222222222';
const L3 = '33333333-3333-4333-8333-333333333333';
const listing = (id: string, vendor: string) => ({
  id,
  title: `Event ${id.slice(0, 1)}`,
  event_date: '2026-10-10T00:00:00',
  event_time: '2026-10-10T18:00:00+00:00',
  location: 'Lagos',
  vendor_id: vendor,
});

const db = (over: Partial<ScannerDb> = {}): ScannerDb => ({
  assignments: () => okRes([]),
  vendorLinks: () => okRes([]),
  isListingScanner: () => okRes(false),
  ...over,
});

describe('loadScannableEvents', () => {
  it('keeps assignments whose vendor has an active link to me', async () => {
    const r = await loadScannableEvents(
      db({
        assignments: () =>
          okRes([
            { listing_id: L1, listing: listing(L1, 'v1') },
            { listing_id: L2, listing: listing(L2, 'v2') },
          ]),
        vendorLinks: () => okRes([{ vendor_id: 'v1' }]),
      }),
      'u',
    );
    expect(r).toEqual({
      ok: true,
      value: [
        { id: L1, title: 'Event 1', startsAt: '2026-10-10T18:00:00+00:00', location: 'Lagos' },
      ],
    });
  });

  it('falls back to event_date when there is no event_time', async () => {
    const r = await loadScannableEvents(
      db({
        assignments: () =>
          okRes([{ listing_id: L1, listing: { ...listing(L1, 'v1'), event_time: null } }]),
        vendorLinks: () => okRes([{ vendor_id: 'v1' }]),
      }),
      'u',
    );
    expect(r.ok && r.value[0]?.startsAt).toBe('2026-10-10T00:00:00');
  });

  it('includes a hidden listing only when the server confirms access', async () => {
    const isListingScanner = jest.fn((id: string) => okRes(id === L2));
    const r = await loadScannableEvents(
      db({
        assignments: () =>
          okRes([
            { listing_id: L2, listing: null },
            { listing_id: L3, listing: null },
          ]),
        vendorLinks: () => okRes([{ vendor_id: 'v9' }]),
        isListingScanner,
      }),
      'u',
    );
    expect(r).toEqual({
      ok: true,
      value: [{ id: L2, title: null, startsAt: null, location: null }],
    });
    expect(isListingScanner).toHaveBeenCalledTimes(2);
  });

  it('with no active vendor link nothing is eligible and no rpc is made', async () => {
    const isListingScanner = jest.fn(() => okRes(true));
    const r = await loadScannableEvents(
      db({
        assignments: () => okRes([{ listing_id: L2, listing: null }]),
        isListingScanner,
      }),
      'u',
    );
    expect(r).toEqual({ ok: true, value: [] });
    expect(isListingScanner).not.toHaveBeenCalled();
  });

  it('de-duplicates repeated assignment rows', async () => {
    const row = { listing_id: L1, listing: listing(L1, 'v1') };
    const r = await loadScannableEvents(
      db({ assignments: () => okRes([row, row]), vendorLinks: () => okRes([{ vendor_id: 'v1' }]) }),
      'u',
    );
    expect(r.ok && r.value).toHaveLength(1);
  });

  it('surfaces read failures and malformed rows as errors', async () => {
    expect(await loadScannableEvents(db({ assignments: () => errRes(503) }), 'u')).toEqual({
      ok: false,
      error: { kind: 'unavailable', status: 503 },
    });
    expect(await loadScannableEvents(db({ vendorLinks: () => errRes(0) }), 'u')).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
    expect(await loadScannableEvents(db({ assignments: () => okRes([{ nope: 1 }]) }), 'u')).toEqual(
      { ok: false, error: { kind: 'validation' } },
    );
    expect(
      await loadScannableEvents(
        db({
          assignments: () => okRes([{ listing_id: L2, listing: null }]),
          vendorLinks: () => okRes([{ vendor_id: 'v1' }]),
          isListingScanner: () => errRes(503),
        }),
        'u',
      ),
    ).toEqual({ ok: false, error: { kind: 'unavailable', status: 503 } });
  });
});

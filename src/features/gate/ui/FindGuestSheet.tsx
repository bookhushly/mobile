import { Phone, UserRound } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

import { ago } from '@/features/gate/domain/ago';
import { parseLookup, type LookupQuery } from '@/features/gate/domain/lookupQuery';
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import type { PinCheck } from '@/features/gate/offline/offlineGate';
import type { Approval } from '@/features/gate/offline/outboxStore';
import type { GuestRow } from '@/features/gate/offline/rosterStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { PinSheet } from '@/features/gate/ui/PinSheet';
import { parseIsoMs } from '@/shared/lib/isoTime';
import { color, radius } from '@/shared/theme';
import {
  Banner,
  Button,
  EmptyState,
  Icon,
  ListRow,
  SearchField,
  SegmentedControl,
  Sheet,
  StatusPill,
  Text,
} from '@/shared/ui';

type Props = {
  visible: boolean;
  search: (q: LookupQuery) => Promise<GuestRow[]>;
  bookingTickets: (bookingId: string) => Promise<GuestRow[]>;
  needsPin: () => Promise<boolean>;
  checkPin: (pin: string) => Promise<PinCheck>;
  admit: (ticketId: string, approval: Approval | null) => Promise<ScanOutcome>;
  /** The scanner shows it via session.show and closes the sheet. */
  onAdmitted: (o: ScanOutcome) => void;
  onClose: () => void;
};

const DEBOUNCE_MS = 250;
const ADMIT_FAILED = 'Not recorded — try again';

const ticketLabel = (g: GuestRow) =>
  `${g.ticketType ?? 'Ticket'}${g.ticketIndex === null ? '' : ` · ticket ${String(g.ticketIndex)}`}`;
// Names and phones are shown on screen only; never logged.
const who = (g: GuestRow) => g.holderName ?? g.phoneMasked ?? 'No name on ticket';
const statusOf = (g: GuestRow) =>
  g.bookingStatus !== 'confirmed'
    ? `Booking ${g.bookingStatus}`
    : g.checkedInAt !== null
      ? 'In'
      : 'Not in';
const canAdmit = (g: GuestRow) => g.bookingStatus === 'confirmed' && g.checkedInAt === null;

const AVATAR = 40;
const FILTERS = [
  { value: 'out', label: 'Not in' },
  { value: 'in', label: 'In' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];
const matchesFilter = (g: GuestRow, filter: Filter) =>
  filter === 'in' ? g.checkedInAt !== null : g.checkedInAt === null;

// Initials for a name, a phone glyph for a masked number, a person glyph when the ticket has neither.
function Initials({ g }: { g: GuestRow }) {
  const name = g.holderName;
  const initials = (name ?? '')
    .split(/\s+/)
    .filter((w) => w !== '')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      style={{
        width: AVATAR,
        height: AVATAR,
        borderRadius: radius.rFull,
        backgroundColor: color.wash,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {name !== null ? (
        <Text variant="label" tone="textSecondary" maxScale={1}>
          {initials}
        </Text>
      ) : g.phoneMasked !== null ? (
        <Icon as={Phone} size="sm" tone="textSecondary" />
      ) : (
        <Icon as={UserRound} size="sm" tone="textSecondary" />
      )}
    </View>
  );
}

function GuestStatus({ g, nowMs }: { g: GuestRow; nowMs: number }) {
  if (g.bookingStatus !== 'confirmed')
    return <StatusPill tone="warning" label={`Booking ${g.bookingStatus}`} />;
  if (g.checkedInAt !== null)
    return (
      <StatusPill tone="success" label={`In · ${ago(parseIsoMs(g.checkedInAt) ?? nowMs, nowMs)}`} />
    );
  return <StatusPill tone="neutral" label="Not in" />;
}

function Message({ children }: { children: string }) {
  return (
    <Text variant="body" tone="textMuted" accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

type Found = { query: LookupQuery; rows: GuestRow[] | 'failed' };
type Booking = { bookingId: string; rows: GuestRow[] | 'failed' | null };

export function FindGuestSheet({
  visible,
  search,
  bookingTickets,
  needsPin,
  checkPin,
  admit,
  onAdmitted,
  onClose,
}: Props) {
  const noList = useSyncView((s) => s.status.list === null);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<Filter>('out');
  const [found, setFound] = useState<Found | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  // "In · 5 min ago" is relative to when the rows arrived (render must not read the clock).
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [admitting, setAdmitting] = useState<string | null>(null);
  // The generation is kept with the ticket so the PIN path settles like the direct one.
  const [pinFor, setPinFor] = useState<{ ticketId: string; gen: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One admission per opening: after an outcome the scanner takes over and closes the sheet.
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const gen = useRef(0);
  const [wasVisible, setWasVisible] = useState(visible);

  // Reset on close (adjusting state during render, not in an effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setText('');
      setFilter('out');
      setFound(null);
      setBooking(null);
      setAdmitting(null);
      setPinFor(null);
      setDone(false);
      setError(null);
    }
  }
  useEffect(() => {
    if (!visible) {
      gen.current += 1;
      busy.current = false;
    }
  }, [visible]);

  // Memoised for identity, not cost: the search effect depends on `query`, and a fresh object each
  // render would restart the debounce on every unrelated re-render.
  const query = useMemo(() => parseLookup(text), [text]);

  useEffect(() => {
    if (!visible || noList || query === null) return;
    let live = true;
    const t = setTimeout(() => {
      search(query).then(
        (rows) => {
          if (live) {
            setNowMs(Date.now());
            setFound({ query, rows });
          }
        },
        () => {
          if (live) setFound({ query, rows: 'failed' });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [visible, noList, query, search]);

  const bookingId = booking?.bookingId ?? null;
  useEffect(() => {
    if (!visible || bookingId === null) return;
    let live = true;
    bookingTickets(bookingId).then(
      (rows) => {
        if (live) {
          setNowMs(Date.now());
          setBooking({ bookingId, rows });
        }
      },
      () => {
        if (live) setBooking({ bookingId, rows: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [visible, bookingId, bookingTickets]);

  // Only this sheet's own state is generation-guarded (a closed sheet shows nothing).
  const fail = (mine: number) => {
    if (mine !== gen.current) return;
    busy.current = false;
    setAdmitting(null);
    setError(ADMIT_FAILED);
  };

  async function run(ticketId: string, approval: Approval | null, mine: number) {
    let outcome: ScanOutcome;
    try {
      outcome = await admit(ticketId, approval);
    } catch {
      fail(mine);
      return;
    }
    if (mine === gen.current) {
      // busy stays set: this opening has admitted; closing resets it.
      setAdmitting(null);
      setDone(true);
    }
    // The admission is recorded: its outcome must reach the scanner even if the sheet closed.
    onAdmitted(outcome);
  }

  async function start(ticketId: string) {
    if (busy.current) return;
    busy.current = true;
    const mine = gen.current;
    setError(null);
    setAdmitting(ticketId);
    let pin: boolean;
    try {
      pin = await needsPin();
    } catch {
      fail(mine);
      return;
    }
    if (mine !== gen.current) return;
    // A live-ticket event: the gate wants a fresh single-use PIN grant, so admit right after it.
    if (pin) setPinFor({ ticketId, gen: mine });
    else await run(ticketId, null, mine);
  }

  const results = found !== null && found.query === query ? found.rows : null;

  const rows = Array.isArray(results) ? results : null;
  const tabs = FILTERS.map((f) => ({
    ...f,
    count: rows === null ? undefined : rows.filter((g) => matchesFilter(g, f.value)).length,
  }));

  const body = () => {
    if (noList)
      return <EmptyState illustration="search" title="No offline list on this phone yet" />;
    if (query === null) return <Message>Type a name or 2–4 phone digits</Message>;
    if (results === null) return <Message>Searching…</Message>;
    if (results === 'failed') return <Banner tone="neutral" message="Couldn’t search the list" />;
    if (results.length === 0) return <Message>No one matches</Message>;
    const inCount = results.filter((g) => matchesFilter(g, 'in')).length;
    return (
      <FlatList
        data={results.filter((g) => matchesFilter(g, filter))}
        keyExtractor={(g) => g.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Message>
            {filter === 'in' ? 'No one in yet' : `No one here — ${String(inCount)} already in`}
          </Message>
        }
        renderItem={({ item }) => (
          <ListRow
            leading={<Initials g={item} />}
            title={who(item)}
            subtitle={ticketLabel(item)}
            trailing={<GuestStatus g={item} nowMs={nowMs} />}
            accessibilityLabel={`${who(item)}, ${ticketLabel(item)}, ${statusOf(item)}`}
            onPress={() => {
              setError(null);
              setBooking({ bookingId: item.bookingId, rows: null });
            }}
          />
        )}
      />
    );
  };

  const bookingBody = (b: Booking) => {
    if (b.rows === null) return <Message>Loading…</Message>;
    if (b.rows === 'failed') return <Banner tone="neutral" message="Couldn’t load this booking" />;
    return (
      <FlatList
        data={b.rows}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <ListRow
            leading={<Initials g={item} />}
            title={who(item)}
            subtitle={ticketLabel(item)}
            note={<GuestStatus g={item} nowMs={nowMs} />}
            // Admit must stay its own element: a grouped row would hide it from VoiceOver.
            groupAccessibility={false}
            trailing={
              canAdmit(item) ? (
                <Button
                  label="Admit"
                  accessibilityLabel={`Admit ${who(item)}, ${ticketLabel(item)}`}
                  loading={admitting === item.id}
                  disabled={admitting !== null || done}
                  onPress={() => void start(item.id)}
                />
              ) : undefined
            }
          />
        )}
      />
    );
  };

  return (
    <Sheet
      visible={visible}
      title={booking === null ? 'Find guest' : 'Booking'}
      onClose={onClose}
      closeDisabled={admitting !== null}
      testID="find-guest-sheet"
      onRequestClose={() => {
        // Back / swipe must not hide an admission that is still being recorded.
        if (admitting === null) onClose();
      }}
      footer={
        booking === null ? undefined : (
          <Button
            variant="secondary"
            label="Back to results"
            disabled={admitting !== null}
            onPress={() => {
              setBooking(null);
              setError(null);
            }}
          />
        )
      }
    >
      {booking === null ? (
        <>
          <SearchField
            label="Search guests"
            value={text}
            onChangeText={setText}
            placeholder="Name or last phone digits"
            autoCapitalize="words"
          />
          <SegmentedControl value={filter} options={tabs} onChange={setFilter} />
          {body()}
        </>
      ) : (
        <>
          {bookingBody(booking)}
          {error !== null ? <Banner tone="neutral" message={error} live="assertive" /> : null}
        </>
      )}
      <PinSheet
        visible={pinFor !== null}
        purpose="lookup"
        check={checkPin}
        onApproved={(approval) => {
          const p = pinFor;
          setPinFor(null);
          if (p !== null) void run(p.ticketId, approval, p.gen);
        }}
        onClose={() => {
          setPinFor(null);
          busy.current = false;
          setAdmitting(null);
        }}
      />
    </Sheet>
  );
}

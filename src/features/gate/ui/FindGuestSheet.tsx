import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseLookup, type LookupQuery } from '@/features/gate/domain/lookupQuery';
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import type { PinCheck } from '@/features/gate/offline/offlineGate';
import type { Approval } from '@/features/gate/offline/outboxStore';
import type { GuestRow } from '@/features/gate/offline/rosterStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { PinSheet } from '@/features/gate/ui/PinSheet';
import { color, density, space } from '@/shared/theme';
import { Button, Input, Text } from '@/shared/ui';

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
const ADMIT_FAILED = 'Couldn’t admit — try again';

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

function Status({ g }: { g: GuestRow }) {
  const s = statusOf(g);
  return (
    <Text
      variant="labelSm"
      style={{
        color:
          s === 'In'
            ? color.status.success.fg
            : s === 'Not in'
              ? color.textSecondary
              : color.status.warning.fg,
      }}
    >
      {s}
    </Text>
  );
}

function Message({ children }: { children: string }) {
  return (
    <Text variant="body" tone="textSecondary" accessibilityLiveRegion="polite">
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
  const [found, setFound] = useState<Found | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
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

  const query = useMemo(() => parseLookup(text), [text]);

  useEffect(() => {
    if (!visible || noList || query === null) return;
    let live = true;
    const t = setTimeout(() => {
      search(query).then(
        (rows) => {
          if (live) setFound({ query, rows });
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
        if (live) setBooking({ bookingId, rows });
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

  const body = () => {
    if (noList) return <Message>No offline list on this phone yet</Message>;
    if (query === null) return <Message>Type a name or 2–4 phone digits</Message>;
    if (results === null) return <Message>Searching…</Message>;
    if (results === 'failed') return <Message>Couldn’t search the list</Message>;
    if (results.length === 0) return <Message>No one matches</Message>;
    return (
      <FlatList
        data={results}
        keyExtractor={(g) => g.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${who(item)}, ${ticketLabel(item)}, ${statusOf(item)}`}
            onPress={() => {
              setError(null);
              setBooking({ bookingId: item.bookingId, rows: null });
            }}
            style={({ pressed }) => ({
              minHeight: density.work.rowMin,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.s3,
              borderBottomWidth: 1,
              borderBottomColor: color.border,
              backgroundColor: pressed ? color.wash : color.surface,
            })}
          >
            <View style={{ flex: 1, gap: space.s1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {who(item)}
              </Text>
              <Text variant="bodySm" tone="textSecondary">
                {ticketLabel(item)}
              </Text>
            </View>
            <Status g={item} />
          </Pressable>
        )}
      />
    );
  };

  const bookingBody = (b: Booking) => {
    if (b.rows === null) return <Message>Loading…</Message>;
    if (b.rows === 'failed') return <Message>Couldn’t load this booking</Message>;
    return (
      <FlatList
        data={b.rows}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <View
            style={{
              minHeight: density.work.rowMin,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.s3,
              paddingVertical: space.s2,
              borderBottomWidth: 1,
              borderBottomColor: color.border,
            }}
          >
            <View style={{ flex: 1, gap: space.s1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {who(item)}
              </Text>
              <Text variant="bodySm" tone="textSecondary">
                {ticketLabel(item)}
              </Text>
              <Status g={item} />
            </View>
            {canAdmit(item) ? (
              <Button
                label="Admit"
                accessibilityLabel={`Admit ${who(item)}, ${ticketLabel(item)}`}
                loading={admitting === item.id}
                disabled={admitting !== null || done}
                onPress={() => void start(item.id)}
              />
            ) : null}
          </View>
        )}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      testID="find-guest-sheet"
      onRequestClose={() => {
        // Back / swipe must not hide an admission that is still being recorded.
        if (admitting === null) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
        <View style={{ padding: space.s5, gap: space.s4, flex: 1 }}>
          <Text variant="title" accessibilityRole="header">
            {booking === null ? 'Find guest' : 'Booking'}
          </Text>
          {booking === null ? (
            <>
              <Input
                label="Search guests"
                value={text}
                onChangeText={setText}
                placeholder="Name or last phone digits"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="words"
                returnKeyType="search"
              />
              {body()}
            </>
          ) : (
            <>
              {bookingBody(booking)}
              {error !== null ? (
                <Text
                  variant="bodyStrong"
                  accessibilityLiveRegion="polite"
                  style={{ color: color.status.danger.fg }}
                >
                  {error}
                </Text>
              ) : null}
              <Button
                variant="secondary"
                label="Back to results"
                disabled={admitting !== null}
                onPress={() => {
                  setBooking(null);
                  setError(null);
                }}
              />
            </>
          )}
          <Button
            variant="secondary"
            label="Close"
            disabled={admitting !== null}
            onPress={onClose}
          />
        </View>
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
      </SafeAreaView>
    </Modal>
  );
}

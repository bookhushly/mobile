import { Building2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { VendorApartment } from '@/features/vendor/domain/calendarBlocks';
import { addMonths, monthGrid } from '@/features/vendor/domain/calendarMonth';
import type { StayProblem } from '@/features/vendor/hooks/useListings';
import { longDate, type IsoDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, pressedOpacity, radius, space } from '@/shared/theme';
import {
  Banner,
  EmptyState,
  ErrorState,
  FilterChips,
  IconButton,
  Screen,
  SkeletonRows,
  Text,
} from '@/shared/ui';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Props = {
  /** The vendor's apartments; the month below is the chosen one's. */
  apartments:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; list: VendorApartment[]; selected: string | null };
  onApartment: (id: string) => void;
  onOpenWeb: () => void;
  today: IsoDate;
  month: IsoDate;
  onMonth: (m: IsoDate) => void;
  state:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; booked: IsoDate[]; blocked: IsoDate[] };
  busyDate: IsoDate | null;
  problem: StayProblem | null;
  onToggle: (d: IsoDate) => void;
};

/**
 * Apartments: which nights are booked, and blocking nights you can't take guests. Booked nights
 * are solid ink; blocked ones are outlined; tap a free or blocked night to switch it.
 */
export function CalendarScreen({
  apartments,
  onApartment,
  onOpenWeb,
  today,
  month,
  onMonth,
  state,
  busyDate,
  problem,
  onToggle,
}: Props) {
  const grid = monthGrid(month);
  const booked = new Set(state.status === 'ready' ? state.booked : []);
  const blocked = new Set(state.status === 'ready' ? state.blocked : []);
  const atStart = month <= addMonths(today, 0);
  const title = (
    <Text variant="titleLg" accessibilityRole="header">
      Calendar
    </Text>
  );
  const only =
    apartments.status === 'ready' && apartments.list.length === 1 ? apartments.list[0] : undefined;
  if (apartments.status !== 'ready' || apartments.list.length === 0)
    return (
      <Screen scroll>
        <View style={{ gap: space.s5, paddingTop: space.s5, paddingBottom: space.s8 }}>
          {title}
          {apartments.status === 'loading' ? (
            <SkeletonRows count={5} />
          ) : apartments.status === 'error' ? (
            <ErrorState
              title="We couldn’t load your apartments"
              message="Nothing has changed on your calendar. Try again."
              onRetry={apartments.retry}
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="No apartment yet"
              message="Add your apartment on bookhushly.com, then manage its nights here."
              action={{ label: 'Open bookhushly.com', onPress: onOpenWeb }}
            />
          )}
        </View>
      </Screen>
    );
  const list = apartments.list;
  return (
    <Screen scroll>
      <View style={{ gap: space.s5, paddingTop: space.s5, paddingBottom: space.s8 }}>
        {only !== undefined ? (
          // One apartment: its name is the subject of the page, read with the heading.
          <View accessible accessibilityRole="header" accessibilityLabel={`Calendar, ${only.name}`}>
            {title}
            <Text variant="body" tone="textSecondary">
              {only.name}
            </Text>
          </View>
        ) : (
          title
        )}
        {only !== undefined ? null : (
          <FilterChips
            label="Apartment"
            value={apartments.selected ?? ''}
            options={list.map((a) => ({ value: a.id, label: a.name }))}
            onChange={onApartment}
            testID="vendor-calendar-apartments"
          />
        )}
        <Text variant="bodySm" tone="textSecondary">
          Tap a night to block it so nobody can book it. Tap again to open it.
        </Text>
        {problem === null ? null : (
          <Banner
            tone={problem.transient ? 'neutral' : 'warning'}
            title={problem.title}
            message={problem.message}
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Previous month"
            disabled={atStart}
            onPress={() => {
              onMonth(addMonths(month, -1));
            }}
          />
          <Text variant="label" align="center" style={{ flex: 1 }} accessibilityRole="header">
            {grid.title}
          </Text>
          <IconButton
            icon={ChevronRight}
            accessibilityLabel="Next month"
            onPress={() => {
              onMonth(addMonths(month, 1));
            }}
          />
        </View>
        {state.status === 'loading' ? (
          <SkeletonRows count={5} />
        ) : state.status === 'error' ? (
          <ErrorState
            title="We couldn’t load your calendar"
            message="Your blocked nights haven’t changed. Try again."
            onRetry={state.retry}
          />
        ) : (
          <View>
            <View style={{ flexDirection: 'row' }}>
              {WEEK.map((w) => (
                <Text
                  key={w}
                  variant="caption"
                  tone="textSecondary"
                  align="center"
                  style={{ flex: 1 }}
                >
                  {w}
                </Text>
              ))}
            </View>
            {Array.from({ length: grid.cells.length / 7 }, (_, row) => (
              <View key={String(row)} style={{ flexDirection: 'row' }}>
                {grid.cells.slice(row * 7, row * 7 + 7).map((d, i) => {
                  if (d === null)
                    return <View key={`b${String(i)}`} style={{ flex: 1, aspectRatio: 1 }} />;
                  const isBooked = booked.has(d);
                  const isBlocked = blocked.has(d);
                  const past = d < today;
                  const state2 = isBooked
                    ? 'booked'
                    : isBlocked
                      ? 'blocked'
                      : past
                        ? 'past'
                        : 'free';
                  return (
                    <Pressable
                      key={d}
                      disabled={past || isBooked || busyDate !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`${longDate(d)}, ${state2 === 'past' ? 'past' : state2}`}
                      accessibilityHint={
                        past || isBooked
                          ? undefined
                          : isBlocked
                            ? 'Double tap to open this night for bookings'
                            : 'Double tap to block this night'
                      }
                      accessibilityState={{
                        disabled: past || isBooked || busyDate !== null,
                        selected: isBlocked,
                      }}
                      onPress={() => {
                        onToggle(d);
                      }}
                      style={{ flex: 1, aspectRatio: 1, padding: space.s1 }}
                    >
                      <View
                        style={{
                          flex: 1,
                          borderRadius: radius.r2,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isBooked ? color.textPrimary : 'transparent',
                          borderWidth: isBlocked ? borderWidth.thick : 0,
                          borderColor: color.textPrimary,
                          opacity: busyDate === d ? pressedOpacity : 1,
                        }}
                      >
                        <Text
                          variant="labelSm"
                          tabular
                          tone={isBooked ? 'onInverse' : past ? 'textMuted' : 'textPrimary'}
                          style={isBlocked ? { textDecorationLine: 'line-through' } : undefined}
                        >
                          {String(Number(d.slice(8)))}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: space.s6, marginTop: space.s4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
                <View
                  style={{
                    width: space.s5,
                    height: space.s5,
                    borderRadius: radius.r1,
                    backgroundColor: color.textPrimary,
                  }}
                />
                <Text variant="caption">Booked</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
                <View
                  style={{
                    width: space.s5,
                    height: space.s5,
                    borderRadius: radius.r1,
                    borderWidth: borderWidth.thick,
                    borderColor: color.textPrimary,
                  }}
                />
                <Text variant="caption">Blocked by you</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

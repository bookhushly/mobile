import { ArrowRight } from 'lucide-react-native';
import { useCallback, useState, type ReactElement } from 'react';
import { View } from 'react-native';

import { pickDay } from '@/features/customer/domain/carRental/carRequest';
import {
  TRIP_NAME_MAX,
  TRIP_NOTES_MAX,
  TRIP_POPULAR,
  TRIP_SERVICES,
  tripDestinationOf,
  type TripDraft,
  type TripServiceType,
} from '@/features/customer/domain/trips/trips';
import { useTripDraft } from '@/features/customer/hooks/useTripDraft';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { StateSheet } from '@/features/customer/ui/car/StateSheet';
import { StateField } from '@/features/customer/ui/car/WhereStep';
import { shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Input, RangeCalendar, SectionHeader, Stack, Text } from '@/shared/ui';

type StepProps = { draft: TripDraft; onChange: (p: Partial<TripDraft>) => void };

const popular: readonly string[] = TRIP_POPULAR;

/** Where: a quick pick, or any other state from the list. Optional. */
export function TripWhereStep({ draft, onChange }: StepProps) {
  const [picking, setPicking] = useState(false);
  const other = draft.destination !== null && !popular.includes(draft.destination);
  return (
    <Stack gap="s6">
      <ChoiceChips
        label="Popular"
        value={
          draft.destination !== null && popular.includes(draft.destination)
            ? draft.destination
            : null
        }
        options={TRIP_POPULAR.map((p) => ({ value: p, label: p }))}
        onChange={(v) => {
          onChange({ destination: v });
        }}
        testID="trip-popular"
      />
      <StateField
        label="Another state"
        value={other ? draft.destination : null}
        onPress={() => {
          setPicking(true);
        }}
        testID="trip-state"
      />
      <StateSheet
        visible={picking}
        title="Where are you going?"
        value={draft.destination}
        onPick={(s) => {
          onChange({ destination: tripDestinationOf(s) });
          setPicking(false);
        }}
        onClose={() => {
          setPicking(false);
        }}
      />
    </Stack>
  );
}

function DateBox({
  label,
  value,
  active,
}: {
  label: string;
  value: string | null;
  active: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        gap: space.s1,
        padding: space.s4,
        borderRadius: radius.r3,
        borderWidth: active ? borderWidth.thick : borderWidth.hairline,
        borderColor: active ? color.textPrimary : color.borderStrong,
      }}
    >
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Text
        variant="bodyStrong"
        tone={value === null ? 'textMuted' : 'textPrimary'}
        numberOfLines={1}
      >
        {value ?? 'Add date'}
      </Text>
    </View>
  );
}

/** When: the shared calendar, first tap the start, second the end. Optional. */
export function TripWhenStep({
  draft,
  today,
  title,
  onChange,
}: StepProps & { today: IsoDate; title: ReactElement }) {
  const { startDate, endDate } = draft;
  const pick = useCallback(
    (d: IsoDate) => {
      const cur = useTripDraft.getState().draft;
      const next = pickDay({ pickupDate: cur.startDate, returnDate: cur.endDate }, d);
      onChange({ startDate: next.pickupDate, endDate: next.returnDate });
    },
    [onChange],
  );
  const header = (
    <View style={{ gap: space.s5, paddingBottom: space.s5 }}>
      {title}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}
        accessible
        accessibilityLabel={`Starts ${startDate === null ? 'not chosen' : shortDate(startDate)}, ends ${endDate === null ? 'not set' : shortDate(endDate)}`}
      >
        <DateBox
          label="Starts"
          value={startDate === null ? null : shortDate(startDate)}
          active={startDate === null}
        />
        <Icon as={ArrowRight} size="sm" tone="textSecondary" />
        <DateBox
          label="Ends"
          value={endDate === null ? null : shortDate(endDate)}
          active={startDate !== null && endDate === null}
        />
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <RangeCalendar
        header={header}
        today={today}
        months={12}
        start={startDate}
        end={endDate}
        onPick={pick}
        startWord="start"
        endWord="end"
        band="neutral"
        testID="trip-calendar"
      />
    </View>
  );
}

/** Services: the web's two groups; at least one. */
export function TripServicesStep({ draft, onChange }: StepProps) {
  const toggle = (t: TripServiceType) => {
    onChange({
      services: draft.services.includes(t)
        ? draft.services.filter((s) => s !== t)
        : [...draft.services, t],
    });
  };
  const group = (g: 'instant' | 'quotes', label: string) => (
    <View>
      <SectionHeader label={label} />
      {TRIP_SERVICES.filter((s) => s.group === g).map((s) => (
        <CheckRow
          key={s.type}
          label={s.label}
          hint={s.caption}
          checked={draft.services.includes(s.type)}
          onChange={() => {
            toggle(s.type);
          }}
          testID={`trip-service-${s.type}`}
        />
      ))}
    </View>
  );
  return (
    <Stack gap="s6">
      {group('instant', 'Book instantly')}
      {group('quotes', 'Get quotes')}
    </Stack>
  );
}

/** Name (suggested from the answers) and optional notes. */
export function TripNameStep({ draft, onChange }: StepProps) {
  return (
    <Stack gap="s6">
      <Input
        label="Trip name"
        value={draft.name}
        onChangeText={(t) => {
          onChange({ name: t });
        }}
        maxLength={TRIP_NAME_MAX}
        autoCapitalize="sentences"
        testID="trip-name"
      />
      <Input
        label="Notes (optional)"
        value={draft.notes}
        onChangeText={(t) => {
          onChange({ notes: t });
        }}
        placeholder="e.g. Flying in on Friday evening"
        maxLength={TRIP_NOTES_MAX}
        multiline
        testID="trip-notes"
      />
    </Stack>
  );
}

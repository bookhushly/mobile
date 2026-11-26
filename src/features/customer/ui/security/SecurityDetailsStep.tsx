import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  NOTES_MAX,
  PROPERTY_SIZES,
  PROPERTY_TYPES,
  RISK_LEVELS,
  count,
  isPropertyService,
  type SecurityDraft,
} from '@/features/customer/domain/security/securityRequest';
import { CharCounter } from '@/features/customer/ui/CharCounter';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { PROPERTY, RISK, SIZE } from '@/features/customer/ui/security/securityWords';
import { space } from '@/shared/theme';
import { Input, Stack, Text } from '@/shared/ui';

type Props = { draft: SecurityDraft; onChange: (p: Partial<SecurityDraft>) => void };

const PROPERTY_OPTIONS = PROPERTY_TYPES.map((v) => ({ value: v, label: PROPERTY[v] }));
const SIZE_OPTIONS = PROPERTY_SIZES.map((v) => ({ value: v, label: SIZE[v] }));
const RISK_OPTIONS = RISK_LEVELS.map((v) => ({ value: v, label: RISK[v] }));

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.s3 }}>
      <Text variant="label" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const badCount = (raw: string) => Number.isNaN(count(raw) ?? 0);

// Step 6, all optional: the event or the place (only the questions that fit the service), how risky
// it is, past incidents, and anything else.
export function SecurityDetailsStep({ draft, onChange }: Props) {
  const event = draft.service === 'event_security';
  const property = isPropertyService(draft.service);
  return (
    <Stack gap="s7">
      {event ? (
        <Stack gap="s5">
          <Input
            label="What kind of event?"
            value={draft.eventType}
            onChangeText={(t) => {
              onChange({ eventType: t });
            }}
            placeholder="e.g. Wedding reception"
            maxLength={100}
            testID="security-event-type"
          />
          <Input
            label="About how many guests?"
            value={draft.attendance}
            onChangeText={(t) => {
              onChange({ attendance: t });
            }}
            keyboardType="number-pad"
            maxLength={6}
            error={badCount(draft.attendance) ? 'Enter a whole number' : undefined}
            testID="security-attendance"
          />
          <Input
            label="How many hours does it run?"
            value={draft.eventHours}
            onChangeText={(t) => {
              onChange({ eventHours: t });
            }}
            keyboardType="number-pad"
            maxLength={6}
            error={badCount(draft.eventHours) ? 'Enter a whole number' : undefined}
          />
          <CheckRow
            label="VIP guests need close protection"
            checked={draft.vip}
            onChange={(on) => {
              onChange({ vip: on });
            }}
          />
        </Stack>
      ) : null}
      {property ? (
        <Stack gap="s6">
          <Group title="Type of property">
            <ChoiceChips
              label="Type of property"
              value={draft.propertyType}
              options={PROPERTY_OPTIONS}
              onChange={(v) => {
                onChange({ propertyType: v });
              }}
            />
          </Group>
          <Group title="Size">
            <ChoiceChips
              label="Size"
              value={draft.propertySize}
              options={SIZE_OPTIONS}
              onChange={(v) => {
                onChange({ propertySize: v });
              }}
            />
          </Group>
          <Input
            label="How many entrances?"
            value={draft.entrances}
            onChangeText={(t) => {
              onChange({ entrances: t });
            }}
            keyboardType="number-pad"
            maxLength={6}
            error={badCount(draft.entrances) ? 'Enter a whole number' : undefined}
            testID="security-entrances"
          />
          <View>
            <CheckRow
              label="It has CCTV"
              checked={draft.cctv}
              onChange={(on) => {
                onChange({ cctv: on });
              }}
            />
            <CheckRow
              label="It has an alarm"
              checked={draft.alarm}
              onChange={(on) => {
                onChange({ alarm: on });
              }}
            />
          </View>
        </Stack>
      ) : null}
      <Group title="How risky is it?">
        <ChoiceChips
          label="How risky is it?"
          value={draft.risk}
          options={RISK_OPTIONS}
          onChange={(v) => {
            onChange({ risk: v });
          }}
          testID="security-risk"
        />
      </Group>
      <View>
        <CheckRow
          label="There have been incidents before"
          checked={draft.incidents}
          onChange={(on) => {
            onChange(on ? { incidents: true } : { incidents: false, incidentDetails: '' });
          }}
          testID="security-incidents"
        />
      </View>
      {draft.incidents ? (
        <View style={{ gap: space.s2 }}>
          <Input
            label="What happened?"
            value={draft.incidentDetails}
            onChangeText={(t) => {
              onChange({ incidentDetails: t });
            }}
            multiline
            maxLength={NOTES_MAX}
          />
          <CharCounter length={draft.incidentDetails.length} max={NOTES_MAX} />
        </View>
      ) : null}
      <View style={{ gap: space.s2 }}>
        <Input
          label="Anything else they should know? (optional)"
          value={draft.notes}
          onChangeText={(t) => {
            onChange({ notes: t });
          }}
          placeholder="Access, parking, who to report to…"
          multiline
          maxLength={NOTES_MAX}
          testID="security-notes"
        />
        <CharCounter length={draft.notes.length} max={NOTES_MAX} />
      </View>
    </Stack>
  );
}

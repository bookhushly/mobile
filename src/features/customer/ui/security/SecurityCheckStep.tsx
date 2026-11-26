import { View } from 'react-native';

import {
  isPropertyService,
  type SecurityDraft,
  type SecurityStep,
} from '@/features/customer/domain/security/securityRequest';
import { Answer } from '@/features/customer/ui/car/CheckStep';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { dateRange, timeWords } from '@/features/customer/ui/car/carWords';
import {
  PROPERTY,
  RISK,
  SECURITY_SERVICE,
  SHIFT,
  SIZE,
  priceUnit,
  teamWords,
} from '@/features/customer/ui/security/securityWords';
import { formatNaira } from '@/shared/lib/formatNaira';
import { space } from '@/shared/theme';
import { Input, Stack, Text } from '@/shared/ui';

type Props = {
  draft: SecurityDraft;
  guide: { min: number; max: number } | null;
  askName: boolean;
  name: string;
  nameError: string | undefined;
  onName: (t: string) => void;
  askPhone: boolean;
  phone: string;
  phoneError: string | undefined;
  onPhone: (t: string) => void;
  onEdit: (s: SecurityStep) => void;
};

// Step 6: every answer, each editable; the guide price when there is one. Nothing is charged here.
export function SecurityCheckStep(p: Props) {
  const d = p.draft;
  const where = [d.address.trim(), d.state === null ? null : stateName(d.state)]
    .filter((s): s is string => s !== null && s !== '')
    .join(', ');
  const when = [
    d.startDate === null ? '' : dateRange(d.startDate, d.endDate),
    d.startTime === null ? null : `from ${timeWords(d.startTime)}`,
  ]
    .filter((s): s is string => s !== null && s !== '')
    .join(' · ');
  const team = teamWords(d);
  const bring = [
    d.shift === null ? null : SHIFT[d.shift],
    d.backgroundCheck ? 'background-checked' : null,
    d.uniform ? 'uniform' : null,
    d.radios ? 'radios' : null,
    d.canine ? 'guard dog' : null,
    d.vehicle ? 'patrol vehicle' : null,
  ].filter((x): x is string => x !== null);
  // Only what the details step asks for this service, so "None added" is true when shown.
  const event = d.service === 'event_security';
  const property = isPropertyService(d.service);
  const details = [
    event && d.eventType.trim() !== '' ? d.eventType.trim() : null,
    event && d.attendance.trim() !== '' ? `${d.attendance.trim()} guests` : null,
    event && d.vip ? 'VIP protection' : null,
    property && d.propertyType !== null ? PROPERTY[d.propertyType] : null,
    property && d.propertySize !== null ? SIZE[d.propertySize].toLowerCase() : null,
    property && d.entrances.trim() !== '' ? `${d.entrances.trim()} entrances` : null,
    property && d.cctv ? 'CCTV' : null,
    property && d.alarm ? 'alarm' : null,
    d.risk === null ? null : `${RISK[d.risk].toLowerCase()} risk`,
    d.incidents ? 'past incidents' : null,
    d.notes.trim() === '' ? null : 'note added',
  ].filter((x): x is string => x !== null);
  const range =
    p.guide === null
      ? null
      : p.guide.min === p.guide.max
        ? formatNaira(p.guide.min)
        : `${formatNaira(p.guide.min)}–${formatNaira(p.guide.max)}`;
  return (
    <Stack gap="s6">
      <View>
        <Answer
          label="Service"
          value={d.service === null ? '' : SECURITY_SERVICE[d.service].label}
          onEdit={() => {
            p.onEdit('service');
          }}
          testID="check-service"
        />
        <Answer
          label="Where"
          value={where}
          onEdit={() => {
            p.onEdit('where');
          }}
          testID="check-where"
        />
        <Answer
          label="When"
          value={when}
          onEdit={() => {
            p.onEdit('when');
          }}
          testID="check-when"
        />
        <Answer
          label="Team"
          value={team}
          onEdit={() => {
            p.onEdit('team');
          }}
          testID="check-team"
        />
        <Answer
          label="Bring"
          value={bring.length === 0 ? 'Nothing extra' : bring.join(' · ')}
          onEdit={() => {
            p.onEdit('bring');
          }}
          testID="check-bring"
        />
        <Answer
          label="Details"
          value={details.length === 0 ? 'None added' : details.join(' · ')}
          onEdit={() => {
            p.onEdit('details');
          }}
          testID="check-details"
        />
      </View>
      {range !== null &&
      d.state !== null &&
      d.duration !== null &&
      priceUnit(d.duration) !== null ? (
        <View style={{ gap: space.s1 }} testID="check-guide">
          <Text variant="bodyStrong">{`${range} per guard ${priceUnit(d.duration) ?? ''}`}</Text>
          <Text variant="bodySm" tone="textSecondary">
            {`A guide from ${stateName(d.state)} companies’ rates; quotes for your team can differ.`}
          </Text>
        </View>
      ) : null}
      {p.askName ? (
        <Input
          label="Your name"
          value={p.name}
          onChangeText={p.onName}
          autoComplete="name"
          error={p.nameError}
          testID="security-name"
        />
      ) : null}
      {p.askPhone ? (
        <Input
          label="Phone number"
          hint="Companies use it to reach you about this request"
          value={p.phone}
          onChangeText={p.onPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={p.phoneError}
          testID="security-phone"
        />
      ) : null}
      <Text variant="bodySm" tone="textSecondary">
        Nothing is charged now. You pay only when you choose a quote.
      </Text>
    </Stack>
  );
}

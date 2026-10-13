import { CircleCheck, Info, SearchX, WifiOff, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { LiveCodeState } from '@/features/customer/domain/liveCode';
import { staticTicketUrl, type TicketView } from '@/features/customer/domain/tickets';
import { useLiveCode } from '@/features/customer/hooks/useLiveCode';
import { CountdownRing } from '@/features/customer/ui/CountdownRing';
import { LiveClock } from '@/features/customer/ui/LiveClock';
import { lagosWhen, type IsoDate } from '@/shared/lib/lagosDay';
import { color, radius, space, type ColorRole, type StatusTone } from '@/shared/theme';
import { Banner, Icon, QrCode, Skeleton, Text } from '@/shared/ui';

type Props = {
  ticket: TicketView;
  /** On screen: only this card polls its live code (C7). */
  active: boolean;
  /** The event refuses printed codes (C8): never show the static QR. */
  liveOnly: boolean;
  qrSize: number;
  today: IsoDate;
};

const CONNECT = 'Connect to the internet to show this ticket. This event only accepts live codes.';

const FG: Record<StatusTone, ColorRole> = {
  neutral: 'neutralFg',
  info: 'infoFg',
  success: 'successFg',
  warning: 'warningFg',
  danger: 'dangerFg',
};

// Takes the QR's place, so the page doesn't jump between states.
function Panel({ size, children }: { size: number; children: ReactNode }) {
  return (
    <View style={{ width: size, minHeight: size, justifyContent: 'center', gap: space.s4 }}>
      {children}
    </View>
  );
}

function Notice({
  size,
  tone,
  icon,
  text,
}: {
  size: number;
  tone: StatusTone;
  icon: LucideIcon;
  text: string;
}) {
  return (
    <View
      style={{
        width: size,
        minHeight: size,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.s4,
        padding: space.s5,
        borderRadius: radius.r3,
        backgroundColor: color.status[tone].bg,
      }}
    >
      <Icon as={icon} size="lg" tone={FG[tone]} />
      <Text variant="headline" tone={FG[tone]} align="center" accessibilityLiveRegion="polite">
        {text}
      </Text>
    </View>
  );
}

function metaLine(t: TicketView): string {
  return [t.type, `Ticket ${String(t.index)} of ${String(t.total)}`, t.seat && `Seat ${t.seat}`]
    .filter((p): p is string => typeof p === 'string' && p !== '')
    .join(' · ');
}

// One page of the ticket viewer (C7, C8, C11). A known admission needs no poll: it is final.
export function TicketCard({ ticket, active, liveOnly, qrSize, today }: Props) {
  const known = ticket.admittedAt !== null;
  const { state: polled, retry } = useLiveCode(known ? null : ticket.id, active && !known);
  const state: LiveCodeState = known ? { kind: 'admitted', at: ticket.admittedAt } : polled;
  const label = `Ticket ${String(ticket.index)} of ${String(ticket.total)} code`;
  const meta = (
    <Text variant="bodyStrong" align="center">
      {metaLine(ticket)}
    </Text>
  );

  const staticCode = (
    <>
      <QrCode value={staticTicketUrl(ticket.id)} size={qrSize} accessibilityLabel={label} />
      {meta}
      <Text variant="label" tone="textSecondary" tabular selectable align="center">
        {ticket.id.slice(0, 8).toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <Icon as={WifiOff} size="sm" tone="neutralFg" />
        <Text variant="bodySm" tone="neutralFg">
          Offline code — it works at the door
        </Text>
      </View>
    </>
  );
  // Announced (Banner) only on the card on screen, not by every page at once.
  const connect = (
    <>
      {active ? (
        <Panel size={qrSize}>
          <Banner
            tone="neutral"
            icon={WifiOff}
            message={CONNECT}
            action={{ label: 'Try again', onPress: retry }}
          />
        </Panel>
      ) : (
        <Notice size={qrSize} tone="neutral" icon={WifiOff} text={CONNECT} />
      )}
      {meta}
    </>
  );

  let body: ReactNode;
  switch (state.kind) {
    case 'loading':
      body = (
        <>
          <View accessible accessibilityLabel="Loading ticket">
            <Skeleton width={qrSize} height={qrSize} radius="r3" />
          </View>
          {meta}
        </>
      );
      break;
    case 'live':
      body = (
        <>
          <QrCode value={state.token} size={qrSize} accessibilityLabel={label} />
          {meta}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
            {active ? <CountdownRing expiresAt={state.expiresAt} /> : null}
            <Text variant="bodySm" tone="textSecondary">
              Live code · refreshes every 30 s
            </Text>
          </View>
          {active ? <LiveClock /> : null}
        </>
      );
      break;
    case 'rateLimited':
      // A 429 keeps a still-usable code on screen (C7); without one it is the fallback.
      if (state.last !== null)
        body = (
          <>
            <QrCode value={state.last.token} size={qrSize} accessibilityLabel={label} />
            {meta}
            <Text variant="bodySm" tone="textSecondary" align="center">
              Refreshing shortly
            </Text>
            {active ? <LiveClock /> : null}
          </>
        );
      else body = liveOnly ? connect : staticCode;
      break;
    case 'fallback':
      body = liveOnly ? connect : staticCode;
      break;
    case 'admitted': {
      const when = state.at === null ? '' : lagosWhen(state.at, today);
      body = (
        <>
          <Notice
            size={qrSize}
            tone="success"
            icon={CircleCheck}
            text={when === '' ? 'Admitted' : `Admitted ${when}`}
          />
          {meta}
        </>
      );
      break;
    }
    case 'notConfirmed':
      body = (
        <>
          <Notice
            size={qrSize}
            tone="neutral"
            icon={Info}
            text="This booking isn't confirmed yet"
          />
          {meta}
        </>
      );
      break;
    case 'notYours':
      body = (
        <Notice
          size={qrSize}
          tone="neutral"
          icon={SearchX}
          text="This ticket isn't on your account"
        />
      );
      break;
  }
  return (
    <View testID={`ticket-${ticket.id}`} style={{ alignItems: 'center', gap: space.s4 }}>
      {body}
    </View>
  );
}

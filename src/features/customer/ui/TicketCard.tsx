import {
  CircleCheck,
  Info,
  LogIn,
  SearchX,
  Ticket,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { stillUsable, type LiveCodeState } from '@/features/customer/domain/liveCode';
import {
  admittedLine,
  staticTicketUrl,
  ticketMeta,
  type TicketView,
} from '@/features/customer/domain/tickets';
import { useLiveCode } from '@/features/customer/hooks/useLiveCode';
import { CountdownRing } from '@/features/customer/ui/CountdownRing';
import { LiveClock } from '@/features/customer/ui/LiveClock';
import { clock } from '@/shared/api/instance';
import type { IsoDate } from '@/shared/lib/lagosDay';
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
  /** The session expired: back to sign-in (the route's sign-out). */
  onSignIn: () => void;
  /** The signed-in customer's name (their own profile), first on the ticket line; null if unknown. */
  holder: string | null;
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
      {/* Only the page on screen renders a Notice, so one region at a time. */}
      <Text variant="headline" tone={FG[tone]} align="center" accessibilityLiveRegion="polite">
        {text}
      </Text>
    </View>
  );
}

// One page of the ticket viewer (C7, C8, C11). A known admission needs no poll: it is final.
export function TicketCard({ ticket, active, liveOnly, qrSize, today, onSignIn, holder }: Props) {
  const known = ticket.admittedAt !== null;
  const { state: polled, retry } = useLiveCode(known ? null : ticket.id, active && !known);
  const state: LiveCodeState = known ? { kind: 'admitted', at: ticket.admittedAt } : polled;
  const label = `Ticket ${String(ticket.index)} of ${String(ticket.total)} code`;
  const meta = (
    <Text variant="bodyStrong" align="center">
      {ticketMeta(ticket, holder)}
    </Text>
  );

  const staticCode = (
    <>
      <QrCode value={staticTicketUrl(ticket.id)} size={qrSize} accessibilityLabel={label} />
      {meta}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <Icon as={WifiOff} size="sm" tone="neutralFg" />
        <Text variant="bodySm" tone="neutralFg">
          Offline code — it works at the door
        </Text>
      </View>
    </>
  );
  const connect = (
    <>
      <Panel size={qrSize}>
        <Banner
          tone="neutral"
          icon={WifiOff}
          message={CONNECT}
          action={{ label: 'Try again', onPress: retry }}
        />
      </Panel>
      {meta}
    </>
  );
  const signIn = (
    <>
      <Panel size={qrSize}>
        <Banner
          tone="neutral"
          icon={LogIn}
          message="Sign in again to show this ticket"
          action={{ label: 'Sign in', onPress: onSignIn }}
        />
      </Panel>
      {meta}
    </>
  );
  const loading = (
    <>
      <View accessible accessibilityLabel="Loading ticket">
        <Skeleton width={qrSize} height={qrSize} radius="r3" />
      </View>
      {meta}
    </>
  );

  let body: ReactNode;
  if (!active)
    // Off screen (or mid-swipe): the ticket without a code. A code here would not be refreshing,
    // so it could be stale by the time anyone looked at it.
    body = (
      <>
        <View
          testID="ticket-placeholder"
          style={{
            width: qrSize,
            height: qrSize,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.r3,
            backgroundColor: color.wash,
          }}
        >
          <Icon as={Ticket} size="lg" tone="textMuted" />
        </View>
        {meta}
      </>
    );
  else
    switch (state.kind) {
      case 'loading':
        body = loading;
        break;
      case 'live':
        // Held from an earlier visit and past use: the hook swaps it out in its effect; never
        // draw it meanwhile.
        if (!stillUsable(state.expiresAt, clock.serverNow())) {
          body = loading;
          break;
        }
        body = (
          <>
            <QrCode value={state.token} size={qrSize} accessibilityLabel={label} />
            {meta}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
              <CountdownRing expiresAt={state.expiresAt} />
              <Text variant="bodySm" tone="textSecondary">
                Live code · refreshes every 30 s
              </Text>
            </View>
            <LiveClock />
          </>
        );
        break;
      case 'rateLimited':
        // A 429 keeps a still-usable code on screen (C7); without one it is the fallback.
        if (state.last !== null && stillUsable(state.last.expiresAt, clock.serverNow()))
          body = (
            <>
              <QrCode value={state.last.token} size={qrSize} accessibilityLabel={label} />
              {meta}
              <Text variant="bodySm" tone="textSecondary" align="center">
                Refreshing shortly
              </Text>
              <LiveClock />
            </>
          );
        else body = liveOnly ? connect : staticCode;
        break;
      case 'fallback':
        body = liveOnly ? connect : staticCode;
        break;
      case 'signedOut':
        // A printed code still works at the door without a session (C8).
        body = liveOnly ? signIn : staticCode;
        break;
      case 'admitted': {
        body = (
          <>
            <Notice
              size={qrSize}
              tone="success"
              icon={CircleCheck}
              text={admittedLine(state.at, today)}
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
              text="This booking isn’t confirmed yet"
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
            text="This ticket isn’t on your account"
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

import { useEffect, useRef, useState } from 'react';

import type { FlowState } from '@/features/receptionist/domain/checkInFlow';
import { useCheckIn } from '@/features/receptionist/hooks/useCheckIn';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useReassign } from '@/features/receptionist/hooks/useReassign';
import { useTicking } from '@/features/receptionist/hooks/useTicking';
import type { EntryTab } from '@/features/receptionist/ui/CheckInEntry';
import { checkInStep, checkInTitle } from '@/features/receptionist/ui/CheckInSteps';
import {
  CHOOSE_ROOM_TITLE,
  ChooseRoomBody,
  chooseRoomFooter,
  isReassignBusy,
} from '@/features/receptionist/ui/ChooseRoomPanel';
import { Sheet, useAnnounce } from '@/shared/ui';

export type CheckInRequest = { id: number; code: string | null };

type Props = {
  visible: boolean;
  /** A new id per open; with a code the booking is looked up at once (Booking screen path). */
  request: CheckInRequest;
  onClose: () => void;
};

// One lookup per scanned value until the flow is back at entry or the desk edits the code (the
// camera decodes every frame and keeps running after "no booking"). A ref, so two frames before a
// re-render can't both submit.
function useScanOnce(step: FlowState['step'], submit: (raw: string) => void) {
  const scanned = useRef<string | null>(null);
  useEffect(() => {
    if (step === 'entry') scanned.current = null;
  }, [step]);
  return {
    onScan: (raw: string) => {
      if (scanned.current === raw) return;
      scanned.current = raw;
      submit(raw);
    },
    forget: () => {
      scanned.current = null;
    },
  };
}

// R13–R17: type or scan → preview → Check in → one of the §4 outcomes. Lives once in the
// receptionist layout; every "Check in" button opens it through `openCheckIn`. Choosing another
// room (R9) is a step inside this sheet: iOS can't present a second Modal over a page sheet.
export function CheckInSheet({ visible, request, onClose }: Props) {
  const { hotel, today } = useDesk();
  const flow = useCheckIn();
  const { state } = flow;
  const [tab, setTab] = useState<EntryTab>('type');
  const [value, setValue] = useState('');
  const [choosing, setChoosing] = useState(false);

  const booking = 'booking' in state ? state.booking : null;
  const reassign = useReassign(choosing ? booking : null, (b) => {
    setChoosing(false);
    flow.bookingChanged(b);
  });

  // A new open starts fresh (adjusting state during render, not in an effect). Starts unseen so
  // a sheet mounted already open with a code looks it up at once.
  const [seen, setSeen] = useState({ visible: false, id: visible ? -1 : request.id });
  if (seen.visible !== visible || seen.id !== request.id) {
    setSeen({ visible, id: request.id });
    setTab('type');
    setValue(request.code ?? '');
    setChoosing(false);
    reassign.reset();
    flow.reset();
    if (visible && request.code !== null) flow.submit(request.code);
  }

  const scan = useScanOnce(state.step, flow.submit);

  // R17: tick on the server clock while a 429 holds either button.
  const now = useTicking(
    (state.step === 'rateLimited' && state.untilMs !== null) ||
      (choosing && reassign.state.step === 'rateLimited' && reassign.state.untilMs !== null),
  );

  useAnnounce(state.step === 'done' ? 'Checked in' : null);

  if (choosing && booking !== null) {
    const leave = () => {
      reassign.reset();
      setChoosing(false);
    };
    return (
      <Sheet
        visible={visible}
        title={CHOOSE_ROOM_TITLE}
        onClose={onClose}
        closeDisabled={isReassignBusy(reassign)}
        testID="check-in-sheet"
        footer={chooseRoomFooter(reassign, now, leave)}
      >
        <ChooseRoomBody booking={booking} r={reassign} now={now} onClose={leave} />
      </Sheet>
    );
  }

  const { body, footer } = checkInStep({
    flow,
    hotelName: hotel.name,
    today,
    now,
    visible,
    tab,
    onTab: setTab,
    value,
    onChangeValue: (v) => {
      scan.forget();
      setValue(v);
    },
    onScan: scan.onScan,
    onChooseRoom: () => {
      setChoosing(true);
    },
    onClose,
  });

  return (
    <Sheet
      visible={visible}
      title={checkInTitle(state)}
      onClose={onClose}
      closeDisabled={state.step === 'sending' || state.step === 'rechecking'}
      scroll
      testID="check-in-sheet"
      footer={footer}
    >
      {body}
    </Sheet>
  );
}

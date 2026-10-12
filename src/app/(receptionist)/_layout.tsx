import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';
import { DeskProvider } from '@/features/receptionist/hooks/DeskContext';
import { useDeskLive } from '@/features/receptionist/hooks/useDeskLive';
import { useHotel } from '@/features/receptionist/hooks/useHotel';
import { HotelGateScreen } from '@/features/receptionist/screens/HotelGateScreen';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { CheckInSheet, type CheckInRequest } from '@/features/receptionist/ui/CheckInSheet';
import { DeskAccountSheet } from '@/features/receptionist/ui/DeskAccountSheet';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { DensityProvider } from '@/shared/ui/DensityProvider';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export const unstable_settings = { initialRouteName: '(tabs)' };

// R4: the desk's day is the Lagos day by the server clock, re-read each minute so midnight moves it.
const TODAY_TICK_MS = 60_000;

// R10: one Realtime channel per hotel for the whole desk; events only trigger refetches.
function DeskLive({ hotelId }: { hotelId: string }) {
  useDeskLive(hotelId);
  return null;
}

export default function ReceptionistLayout() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const userId = state.status === 'signedIn' ? state.userId : '';
  const email = state.status === 'signedIn' ? state.email : '';
  const { modes, choose } = useModeSwitcher(userId === '' ? null : userId);
  const hotel = useHotel(userId);

  const [today, setToday] = useState(() => lagosToday(clock.serverNow()));
  useEffect(() => {
    const t = setInterval(() => {
      setToday(lagosToday(clock.serverNow()));
    }, TODAY_TICK_MS);
    return () => {
      clearInterval(t);
    };
  }, []);
  // R11: the shift log is this session's; leaving the desk (sign-out, mode switch) empties it.
  useEffect(
    () => () => {
      useShiftLog.getState().clear();
    },
    [],
  );

  const [account, setAccount] = useState(false);
  // Every "Check in" button opens the one sheet; a new id per open restarts its flow.
  const [checkIn, setCheckIn] = useState<{ visible: boolean; request: CheckInRequest }>({
    visible: false,
    request: { id: 0, code: null },
  });

  if (hotel.status !== 'ready')
    return (
      <DensityProvider density="work">
        <HotelGateScreen state={hotel} onSignOut={signOut} />
      </DensityProvider>
    );

  return (
    <DensityProvider density="work">
      <DeskProvider
        value={{
          userId,
          email,
          hotel: hotel.hotel,
          today,
          openAccount: () => {
            setAccount(true);
          },
          openCheckIn: (code) => {
            setCheckIn((c) => ({
              visible: true,
              request: { id: c.request.id + 1, code: code ?? null },
            }));
          },
          // A 401 after refresh during a desk action: the same sign-out as the account sheet.
          signOut,
        }}
      >
        <DeskLive hotelId={hotel.hotel.id} />
        <Stack screenOptions={{ headerShown: false }} />
        <CheckInSheet
          visible={checkIn.visible}
          request={checkIn.request}
          onClose={() => {
            setCheckIn((c) => ({ ...c, visible: false }));
          }}
        />
        <DeskAccountSheet
          visible={account}
          email={email}
          hotelName={hotel.hotel.name}
          canChangeHotel={hotel.hotels.length > 1}
          modeSwitcher={<ModeSwitcher modes={modes} current="receptionist" onChoose={choose} />}
          onChangeHotel={hotel.change}
          onActivity={() => {
            router.push('/activity');
          }}
          // Keep the sheet open: a completed sign-out unmounts this layout anyway.
          onSignOut={signOut}
          onClose={() => {
            setAccount(false);
          }}
        />
      </DeskProvider>
    </DensityProvider>
  );
}

import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';
import { DeskProvider } from '@/features/receptionist/hooks/DeskContext';
import { useHotel } from '@/features/receptionist/hooks/useHotel';
import { HotelGateScreen } from '@/features/receptionist/screens/HotelGateScreen';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { DeskAccountSheet } from '@/features/receptionist/ui/DeskAccountSheet';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';
import { DensityProvider } from '@/shared/ui/DensityProvider';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export const unstable_settings = { initialRouteName: '(tabs)' };

// R4: the desk's day is the Lagos day by the server clock, re-read each minute so midnight moves it.
const TODAY_TICK_MS = 60_000;

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
  // Task 13 renders the check-in sheet from this; until then the request is held and harmless.
  const [, setCheckInRequest] = useState<{ code?: string } | null>(null);

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
            setCheckInRequest(code === undefined ? {} : { code });
          },
        }}
      >
        <Stack screenOptions={{ headerShown: false }} />
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

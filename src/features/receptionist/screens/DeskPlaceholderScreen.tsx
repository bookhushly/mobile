import { router } from 'expo-router';
import { ArrowLeft, Construction, UserRound } from 'lucide-react-native';

import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { EmptyState, Header, IconButton, Screen } from '@/shared/ui';

type Props = { title: string; message: string; back?: boolean };

// Temporary bodies for Today / Guests / Rooms / booking / activity until Tasks 11–15 land.
export function DeskPlaceholderScreen({ title, message, back = false }: Props) {
  const { hotel, openAccount } = useDesk();
  return (
    <Screen
      header={
        <Header
          title={title}
          subtitle={hotel.name}
          left={
            back ? (
              <IconButton
                icon={ArrowLeft}
                accessibilityLabel="Back"
                onPress={() => {
                  router.back();
                }}
              />
            ) : undefined
          }
          right={<IconButton icon={UserRound} accessibilityLabel="Account" onPress={openAccount} />}
        />
      }
    >
      <EmptyState icon={Construction} title={title} message={message} />
    </Screen>
  );
}

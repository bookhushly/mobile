import { ArrowLeft, type LucideIcon } from 'lucide-react-native';

import { EmptyState, Header, IconButton, Screen } from '@/shared/ui';

type Props = {
  /** Header title. */
  title: string;
  icon: LucideIcon;
  heading: string;
  message?: string;
  onBack: () => void;
};

// A whole-screen notice with a way back: a booking that isn't on this account (bad or foreign
// params), or a screen whose content arrives in a later task.
export function NoticeScreen({ title, icon, heading, message, onBack }: Props) {
  return (
    <Screen
      header={
        <Header
          title={title}
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
    >
      <EmptyState icon={icon} title={heading} message={message} />
    </Screen>
  );
}

import { ExternalLink, Heart, Ticket, UserRound, type LucideIcon } from 'lucide-react-native';

import { openWeb } from '@/features/customer/ui/links';
import { HELP_URL, PRIVACY_URL, TERMS_URL } from '@/shared/config/store';
import {
  Button,
  EmptyState,
  Header,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Stack,
} from '@/shared/ui';

export type SignedOutTabName = 'saved' | 'bookings' | 'account';

type Props = {
  tab: SignedOutTabName;
  onSignIn: () => void;
  onCreateAccount: () => void;
};

const COPY: Record<
  SignedOutTabName,
  { page: string; icon: LucideIcon; title: string; message: string }
> = {
  saved: {
    page: 'Saved',
    icon: Heart,
    title: 'Your saved places live here',
    message: 'Saved places and events are kept in your account. Sign in to see them.',
  },
  bookings: {
    page: 'Bookings',
    icon: Ticket,
    title: 'Your bookings live here',
    message: 'Booked on the website? Sign in with the same email and we’ll help you add them.',
  },
  account: {
    page: 'Account',
    icon: UserRound,
    title: 'Your account lives here',
    message: 'With an account you can book, keep your tickets and manage your details.',
  },
};

// Same links and config as AccountScreen's "Help and legal" section.
const LINKS: { title: string; url: string }[] = [
  { title: 'Help', url: HELP_URL },
  { title: 'Terms', url: TERMS_URL },
  { title: 'Privacy', url: PRIVACY_URL },
];

/** What Saved, Bookings and Account show to someone browsing without an account. */
export function SignedOutTab({ tab, onSignIn, onCreateAccount }: Props) {
  const { page, icon, title, message } = COPY[tab];
  return (
    // Every tab opens with its large title, as Explore does (Expedia's Trips and Account).
    <Screen scroll header={<Header title={page} />}>
      <EmptyState testID={`signed-out-${tab}`} icon={icon} title={title} message={message} />
      <Stack gap="s4" testID="signed-out-actions">
        <Button label="Create account" onPress={onCreateAccount} />
        <Button variant="secondary" label="Sign in" onPress={onSignIn} />
      </Stack>
      {tab === 'account' ? (
        <Stack gap="s1">
          <SectionHeader label="Help and legal" />
          {LINKS.map((l) => (
            <ListRow
              key={l.title}
              title={l.title}
              accessibilityLabel={`${l.title}, opens bookhushly.com`}
              onPress={() => {
                openWeb(l.url);
              }}
              trailing={<Icon as={ExternalLink} size="sm" tone="textSecondary" />}
            />
          ))}
        </Stack>
      ) : null}
    </Screen>
  );
}

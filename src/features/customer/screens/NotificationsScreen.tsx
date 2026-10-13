import { ArrowLeft, Bell } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import type { BookingKind } from '@/features/customer/domain/myBookings';
import {
  notificationBookingId,
  notificationTarget,
} from '@/features/customer/domain/notificationTarget';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import { useNotifications } from '@/features/customer/hooks/useNotifications';
import type { NotificationRow as Row } from '@/features/customer/schemas/notifications';
import { NotificationRow } from '@/features/customer/ui/NotificationRow';
import { relativeTime } from '@/features/customer/ui/relativeTime';
import { clock } from '@/shared/api/instance';
import { space } from '@/shared/theme';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  refreshColors,
  Screen,
  Sheet,
  SkeletonRows,
  TextLink,
} from '@/shared/ui';

/** C13: the "All marked as read" Undo stays this long. */
export const UNDO_MS = 5_000;

const STALE = 'Couldn’t update. Sign in again if this keeps happening.';
const TRANSIENT = 'Couldn’t update — try again';

type Props = {
  userId: string;
  onBack: () => void;
  onOpenBooking: (kind: BookingKind, id: string) => void;
  onOpenTab: (tab: 'bookings' | 'account') => void;
};

// Spec C13; Mobbin §5.
export function NotificationsScreen({ userId, onBack, onOpenBooking, onOpenTab }: Props) {
  const notes = useNotifications(userId);
  const my = useMyBookings(userId);
  const [refreshing, setRefreshing] = useState(false);
  const [undoShown, setUndoShown] = useState(false);
  // The row stays set while the sheet slides away, so its content doesn't blank mid-animation.
  const [menuFor, setMenuFor] = useState<Row | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!undoShown) return;
    const t = setTimeout(() => {
      setUndoShown(false);
    }, UNDO_MS);
    return () => {
      clearTimeout(t);
    };
  }, [undoShown]);

  const refresh = () => {
    setRefreshing(true);
    void notes
      .refetch()
      .then((r) => {
        // A clean refresh shows the server's truth: the last write's error no longer applies.
        if (!r.isError) notes.clearWriteError();
      })
      .finally(() => {
        setRefreshing(false);
      });
  };
  // Any other row action ends the Undo: undoing the mark-all after it would flip those rows back
  // regardless of what was done since.
  const rowAction = (run: () => void) => {
    setUndoShown(false);
    run();
  };
  const open = (n: Row) => {
    rowAction(() => {
      notes.open(n);
    });
    const lists = my.bookings;
    // Bookings not loaded yet (cold open, or failed with nothing saved): a booking notification
    // can't be matched, so go to the Bookings tab rather than guess from the link (ruling).
    if (lists === null && notificationBookingId(n) !== null) {
      onOpenTab('bookings');
      return;
    }
    const mine = lists === null ? [] : [...lists.today, ...lists.upcoming, ...lists.past];
    const target = notificationTarget(n, mine);
    if (target === null) return;
    if (target.kind === 'booking') onOpenBooking(target.bookingKind, target.id);
    else onOpenTab(target.tab);
  };
  const markAll = () => {
    notes.markAllRead();
    setUndoShown(true);
  };
  const openMenu = (n: Row) => {
    setMenuFor(n);
    setMenuOpen(true);
  };
  const closeMenu = () => {
    setMenuOpen(false);
  };

  let body: ReactNode;
  if (notes.loading) {
    body = <SkeletonRows count={6} />;
  } else if (notes.error) {
    body = (
      <ErrorState
        title="Couldn’t load your notifications"
        message="Check your connection and try again."
        onRetry={refresh}
      />
    );
  } else {
    const now = clock.serverNow();
    const writeBanner =
      notes.writeError !== null ? (
        <Banner
          tone="neutral"
          message={notes.writeError === 'stale' ? STALE : TRANSIENT}
          action={{ label: 'Dismiss', onPress: notes.clearWriteError }}
        />
      ) : null;
    body = (
      <FlatList
        testID="notifications-list"
        data={notes.items}
        style={{ flex: 1 }}
        keyExtractor={(n: Row) => n.id}
        initialNumToRender={12}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />
        }
        ListHeaderComponent={
          writeBanner === null ? null : (
            <View style={{ paddingBottom: space.s3 }}>{writeBanner}</View>
          )
        }
        ListEmptyComponent={
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            message="Updates about your bookings and payments show up here."
          />
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            when={relativeTime(item.created_at, now)}
            onPress={open}
            onLongPress={openMenu}
          />
        )}
      />
    );
  }

  return (
    <Screen
      header={
        <Header
          title="Notifications"
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
          right={
            <TextLink label="Mark all as read" disabled={notes.unread === 0} onPress={markAll} />
          }
        />
      }
    >
      {body}
      {/* Pinned at the bottom (C13): it stays put while the list scrolls, near the thumb. */}
      {undoShown && !notes.loading && !notes.error && notes.writeError === null ? (
        <View testID="undo-bar" style={{ paddingVertical: space.s3 }}>
          <Banner
            tone="neutral"
            message="All marked as read"
            action={{
              label: 'Undo',
              onPress: () => {
                notes.undoMarkAll();
                setUndoShown(false);
              },
            }}
          />
        </View>
      ) : null}
      <Sheet visible={menuOpen} title={menuFor?.title ?? ''} onClose={closeMenu}>
        {menuFor !== null && menuFor.read ? (
          <Button
            variant="secondary"
            label="Mark as unread"
            onPress={() => {
              rowAction(() => {
                notes.markUnread(menuFor.id);
              });
              closeMenu();
            }}
          />
        ) : null}
        {menuFor !== null && !menuFor.read ? (
          <Button
            variant="secondary"
            label="Mark as read"
            onPress={() => {
              rowAction(() => {
                notes.open(menuFor);
              });
              closeMenu();
            }}
          />
        ) : null}
        <Button
          variant="destructive"
          label="Delete"
          onPress={() => {
            if (menuFor !== null)
              rowAction(() => {
                notes.remove(menuFor.id);
              });
            closeMenu();
          }}
        />
      </Sheet>
    </Screen>
  );
}

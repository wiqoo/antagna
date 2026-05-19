import type { ReactNode } from 'react';
import { AppShell } from '@antagna/ui';
import { fetchNotifications } from '@/lib/notifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-actions';

export async function Shell({
  children,
  user,
  activePath,
}: {
  children: ReactNode;
  user?: { email: string; displayName?: string };
  activePath?: string;
}) {
  const notifications = await fetchNotifications();
  return (
    <AppShell
      user={user}
      activePath={activePath}
      notifications={notifications}
      onMarkAllRead={markAllNotificationsRead}
      onMarkOneRead={markNotificationRead}
    >
      {children}
    </AppShell>
  );
}

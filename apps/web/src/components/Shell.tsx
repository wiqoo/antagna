import type { ReactNode } from 'react';
import { AppShell, CommandPalette } from '@antagna/ui';
import { fetchNotifications } from '@/lib/notifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-actions';
import {
  getRealProfile,
  getCurrentProfile,
  listImpersonatableProfiles,
} from '@/lib/view-as';
import { ViewAsBar } from './ViewAsBar';

const ADMIN_ROLES = new Set(['system_admin', 'system_manager']);

export async function Shell({
  children,
  user,
  activePath,
}: {
  children: ReactNode;
  user?: { email: string; displayName?: string };
  activePath?: string;
}) {
  const [notifications, real, current] = await Promise.all([
    fetchNotifications(),
    getRealProfile(),
    getCurrentProfile(),
  ]);

  // Show the View-As bar only for real admins.
  const showBar = real != null && ADMIN_ROLES.has(real.role);
  const profiles = showBar ? await listImpersonatableProfiles() : [];

  // What the topbar shows — the impersonated identity if active.
  const shellUser = current
    ? { email: current.email, displayName: current.displayName }
    : user;

  return (
    <>
      {showBar && current && real && (
        <ViewAsBar
          profiles={profiles}
          realProfileId={real.id}
          currentProfileId={current.id}
          isImpersonating={current.isImpersonating}
          currentDisplayName={current.displayName}
        />
      )}
      <div style={showBar ? { paddingTop: 26 } : undefined}>
        <AppShell
          user={shellUser}
          activePath={activePath}
          notifications={notifications}
          onMarkAllRead={markAllNotificationsRead}
          onMarkOneRead={markNotificationRead}
          commandPalette={<CommandPalette />}
        >
          {children}
        </AppShell>
      </div>
    </>
  );
}

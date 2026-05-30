import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { AppShell, CommandPalette, NAV_PERM_KEYS } from '@antagna/ui';
import { canMany } from '@/lib/authz';
import { LocaleSwitch } from './LocaleSwitch';
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

const ADMIN_ROLES = new Set(['system_admin', 'general_manager']);

export async function Shell({
  children,
  user,
  activePath,
}: {
  children: ReactNode;
  user?: { email: string; displayName?: string };
  activePath?: string;
}) {
  const [notifications, real, current, permits] = await Promise.all([
    fetchNotifications(),
    getRealProfile(),
    getCurrentProfile(),
    // Which privileged nav items the (effective) user may see — the page itself
    // still gates access; this just hides links the user can't use.
    canMany([...NAV_PERM_KEYS]),
  ]);

  // Show the View-As bar only for real admins.
  const showBar = real != null && ADMIN_ROLES.has(real.role);
  const profiles = showBar ? await listImpersonatableProfiles() : [];

  // What the topbar shows — the impersonated identity if active.
  const shellUser = current
    ? { email: current.email, displayName: current.displayName }
    : user;

  // Translated nav/topbar labels passed into the (i18n-free) AppShell.
  const tNav = await getTranslations('nav');
  const tTop = await getTranslations('topbar');
  const navKeys = [
    'myDay', 'dashboard', 'search', 'projects', 'tasks', 'inbox', 'approvals', 'notifications', 'calendar',
    'clients', 'equipment', 'orders', 'repairs', 'assets', 'social', 'team', 'employees', 'meetings', 'kpis', 'reports', 'changelog', 'admin', 'settings',
    'groupWork', 'groupAnalytics', 'more', 'sidebar', 'bottomNav',
  ] as const;
  const labels: Record<string, string> = Object.fromEntries(
    navKeys.map((k) => [k, tNav(k)]),
  );
  labels.newProject = tTop('newProject');

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
          labels={labels}
          localeSwitch={<LocaleSwitch />}
        >
          {children}
        </AppShell>
      </div>
    </>
  );
}

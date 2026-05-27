/**
 * Role-aware landing — where each role most wants to start. Used by the root
 * dispatcher (and login default) so people land on their highest-value surface
 * instead of a one-size dashboard. Managers keep the overview bento; ICs go
 * straight to their work.
 */
export function roleLanding(role: string | null | undefined): string {
  switch (role) {
    case 'project_manager':
    case 'production_manager':
      return '/projects';
    case 'account_manager':
      return '/crm';
    case 'hr':
      return '/team';
    case 'finance':
      return '/reports';
    case 'system_admin':
    case 'general_manager':
      return '/dashboard';
    case 'user':
    default:
      return '/tasks'; // ICs (shooters/editors) → "my work"
  }
}

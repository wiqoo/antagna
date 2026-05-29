// Shared (non-server) constants for the squads/groups admin. Imported by the
// server actions, server pages, and client islands — no directive.

// squads.purpose is free-text; offer the canonical volt-os set.
export const SQUAD_PURPOSES = [
  'crew',
  'editing_team',
  'content_calendar',
  'shooting_team',
] as const;

export type SquadPurpose = (typeof SQUAD_PURPOSES)[number];

export const PURPOSE_LABEL_AR: Record<string, string> = {
  crew: 'طاقم تصوير',
  editing_team: 'فريق مونتاج',
  content_calendar: 'تقويم محتوى',
  shooting_team: 'فريق إنتاج',
};

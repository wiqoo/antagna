/**
 * Shared constants for the Company Assets register. Kept out of actions.ts
 * because a 'use server' module may only export async functions — exporting
 * these constants/types from there fails the Next.js build.
 */

// Stable sentinel UUID for the single "company" entity that owns all
// company-level (non-entity-scoped) assets in the polymorphic attachments table.
export const COMPANY_ASSET_ENTITY = 'company_asset';
export const COMPANY_ASSET_ID = '00000000-0000-0000-0000-000000000001';

// Asset categories are encoded as a leading tag in the description field
// ("[contract] …") because the attachments table has no category column and
// we don't migrate the schema for this register. The browser parses it back.
export const ASSET_CATEGORIES = [
  'contract',
  'license',
  'insurance',
  'registration',
  'brand',
  'finance',
  'hr',
  'other',
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

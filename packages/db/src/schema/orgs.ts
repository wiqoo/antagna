import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';

// ── enums ───────────────────────────────────────────────────────────────────────

export const clientTypeEnum = pgEnum('client_type', ['brand', 'dealer', 'agency', 'other']);

export const contactMethodTypeEnum = pgEnum('contact_method_type', [
  'email',
  'phone',
  'whatsapp',
  'linkedin',
  'instagram',
  'other',
]);

// ── clients (unified: brand / dealer / agency) ─────────────────────────────────

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // 'MYNM', 'HRMNY', 'ALFUTTAIM'

  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  legalName: text('legal_name'),
  vatNumber: text('vat_number'),
  crNumber: text('cr_number'),

  clientType: clientTypeEnum('client_type').notNull().default('brand'),
  isAgency: boolean('is_agency').notNull().default(false),
  industry: text('industry'),

  country: text('country').notNull().default('SA'),
  city: text('city'),
  addressLines: text('address_lines'),
  websiteUrl: text('website_url'),
  logoUrl: text('logo_url'),

  defaultPaymentTermsKey: text('default_payment_terms_key'),
  averagePaymentDays: integer('average_payment_days'),
  trustScore: integer('trust_score'),

  archivedAt: timestamp('archived_at', { withTimezone: true }),
  notes: text('notes'),
  customFields: jsonb('custom_fields').notNull().default({}),

  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── agency ↔ brand link (M:N within clients) ───────────────────────────────────

export const agencyBrandLinks = pgTable(
  'agency_brand_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => clients.id),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => clients.id),
    sinceDate: text('since_date'), // YYYY-MM-DD
    endDate: text('end_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    unique('agency_brand_unique').on(t.agencyId, t.brandId),
    check('agency_brand_self', sql`${t.agencyId} <> ${t.brandId}`),
  ],
);

// ── contacts (people at a client/agency) ───────────────────────────────────────

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),

  fullName: text('full_name').notNull(),
  fullNameAr: text('full_name_ar'),
  jobTitle: text('job_title'),
  jobTitleAr: text('job_title_ar'),
  department: text('department'),

  isPrimary: boolean('is_primary').notNull().default(false),
  isDecisionMaker: boolean('is_decision_maker').notNull().default(false),
  preferredLanguage: text('preferred_language').default('ar'),

  notes: text('notes'),
  customFields: jsonb('custom_fields').notNull().default({}),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ── contact_methods (1:N — email / phone / whatsapp / etc.) ────────────────────

export const contactMethods = pgTable(
  'contact_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    methodType: contactMethodTypeEnum('method_type').notNull(),
    value: text('value').notNull(),
    normalizedValue: text('normalized_value').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [unique('contact_method_unique').on(t.methodType, t.normalizedValue)],
);

// ── locations (Pillar 16 §D.4 — first-class shooting locations) ────────────────

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  clientId: uuid('client_id').references(() => clients.id),

  city: text('city'),
  district: text('district'),
  addressLines: text('address_lines'),
  countryCode: text('country_code').notNull().default('SA'),
  coordinates: text('coordinates'), // 'lat,lng' — text to avoid PostGIS dep at this stage

  // geo_fences live in Pillar 9 (attendance); FK added then.
  geoFenceId: uuid('geo_fence_id'),

  bestTimeToShoot: text('best_time_to_shoot'),
  parkingInfo: text('parking_info'),
  permitRequired: boolean('permit_required').notNull().default(false),
  permitProvider: text('permit_provider'),
  knownChallenges: text('known_challenges'),

  contactAtLocation: uuid('contact_at_location').references(() => contacts.id),
  insideBuilding: boolean('inside_building'),
  hasPower: boolean('has_power'),
  hasParkingForCrew: boolean('has_parking_for_crew'),

  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type ContactMethod = typeof contactMethods.$inferSelect;
export type Location = typeof locations.$inferSelect;

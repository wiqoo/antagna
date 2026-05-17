/**
 * Pillar 2 §7 — Money tables.
 *
 * Per D-022 these are SCHEMA-ONLY stubs. Real invoicing lives in Dafterah;
 * Antagna stores references (see projects.dafterah_*_number) and keeps these
 * tables so a future Phase 2 finance module has a target.
 *
 * ZATCA fields are kept nullable for future activation; no logic wired today.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  numeric,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './people';
import { clients } from './orgs';
import { projects } from './projects';

// ── enums ──────────────────────────────────────────────────────────────────────

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'superseded',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'written_off',
]);

// ── quotes ─────────────────────────────────────────────────────────────────────

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  projectId: uuid('project_id').references(() => projects.id),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),

  status: quoteStatusEnum('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  parentQuoteId: uuid('parent_quote_id'),

  subtotalSar: numeric('subtotal_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  discountSar: numeric('discount_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  vatRate: numeric('vat_rate', { precision: 5, scale: 4 }).notNull().default('0.15'),
  vatSar: numeric('vat_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  totalSar: numeric('total_sar', { precision: 12, scale: 2 }).notNull().default('0'),

  issuedAt: timestamp('issued_at', { withTimezone: true }),
  validUntilAt: timestamp('valid_until_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),

  paymentTermsText: text('payment_terms_text'),

  pdfUrl: text('pdf_url'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const quoteLineItems = pgTable('quote_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPriceSar: numeric('unit_price_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  totalSar: numeric('total_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  category: text('category'),
});

// ── invoices ────────────────────────────────────────────────────────────────

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  projectId: uuid('project_id').references(() => projects.id),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  quoteId: uuid('quote_id').references(() => quotes.id),

  status: invoiceStatusEnum('status').notNull().default('draft'),

  issuedAt: timestamp('issued_at', { withTimezone: true }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),

  subtotalSar: numeric('subtotal_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  vatSar: numeric('vat_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  totalSar: numeric('total_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  paidSar: numeric('paid_sar', { precision: 12, scale: 2 }).notNull().default('0'),

  // ZATCA fields — kept nullable per D-022; no logic wired today.
  zatcaUuid: text('zatca_uuid'),
  zatcaHash: text('zatca_hash'),
  zatcaQrUrl: text('zatca_qr_url'),

  pdfUrl: text('pdf_url'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPriceSar: numeric('unit_price_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  totalSar: numeric('total_sar', { precision: 12, scale: 2 }).notNull().default('0'),
  category: text('category'),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  amountSar: numeric('amount_sar', { precision: 12, scale: 2 }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  method: text('method'), // 'bank_transfer' | 'cheque' | 'card' | 'cash'
  referenceNumber: text('reference_number'),
  receivedById: uuid('received_by_id').references(() => profiles.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type Quote = typeof quotes.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;

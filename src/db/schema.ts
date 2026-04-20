import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  real,
  pgEnum,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { AdapterAccountType } from '@auth/core/adapters'

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ─── NextAuth DB Session Tables ───────────────────────────────────────────────

export const accounts = pgTable('accounts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').$type<AdapterAccountType>().notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })])

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })])

// ─── Teams ────────────────────────────────────────────────────────────────────

export const teamRoleEnum = pgEnum('team_role', ['owner', 'admin', 'member'])

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const teamMembers = pgTable('team_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: teamRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('team_members_team_user_idx').on(t.teamId, t.userId),
])

export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type TeamMember = typeof teamMembers.$inferSelect
export type TeamRole = 'owner' | 'admin' | 'member'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const poStatusEnum = pgEnum('po_status', [
  'active',
  'completed',
  'cancelled',
])

export const emailStatusEnum = pgEnum('email_status', [
  'pending',
  'processing',
  'processed',
  'failed',
])

export const confirmationStatusEnum = pgEnum('confirmation_status', [
  'matched',
  'needs_review',
  'high_priority_flag',
  'unmatched',
])

export const mismatchTypeEnum = pgEnum('mismatch_type', [
  'quantity',
  'date',
  'price',
  'unmatched',
])

export const mismatchSeverityEnum = pgEnum('mismatch_severity', [
  'high',
  'medium',
  'low',
])

export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'dead_lettered',
])

export const attachmentStatusEnum = pgEnum('attachment_status', [
  'pending',
  'processing',
  'done',
  'failed',
])

// ─── Tables ───────────────────────────────────────────────────────────────────

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'restrict' }),
  poNumber: text('po_number').notNull(),
  supplierName: text('supplier_name').notNull(),
  expectedQty: integer('expected_qty').notNull(),
  expectedDeliveryDate: date('expected_delivery_date').notNull(),
  expectedUnitPrice: numeric('expected_unit_price', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  status: poStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('purchase_orders_team_po_number_idx').on(t.teamId, t.poNumber),
])

export const emails = pgTable('emails', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'restrict' }),
  messageId: text('message_id'),         // RFC 2822 Message-ID header — used for deduplication
  fromEmail: text('from_email'),          // sender email address
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  supplierName: text('supplier_name'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  status: emailStatusEnum('status').notNull().default('pending'),
  hasAttachments: text('has_attachments').notNull().default('false'),
}, (t) => [
  uniqueIndex('emails_team_message_id_idx').on(t.teamId, t.messageId),
])

export const parsedConfirmations = pgTable('parsed_confirmations', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailId: uuid('email_id').notNull().references(() => emails.id, { onDelete: 'cascade' }),
  poId: uuid('po_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
  confirmedQty: integer('confirmed_qty'),
  confirmedDeliveryDate: date('confirmed_delivery_date'),
  confirmedUnitPrice: numeric('confirmed_unit_price', { precision: 12, scale: 2 }),
  currency: text('currency'),
  extractedNotes: text('extracted_notes'),
  confidence: real('confidence').notNull().default(0),
  status: confirmationStatusEnum('status').notNull().default('unmatched'),
  rawJson: jsonb('raw_json'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const mismatches = pgTable('mismatches', {
  id: uuid('id').defaultRandom().primaryKey(),
  parsedConfirmationId: uuid('parsed_confirmation_id').notNull().references(() => parsedConfirmations.id, { onDelete: 'cascade' }),
  type: mismatchTypeEnum('type').notNull(),
  severity: mismatchSeverityEnum('severity').notNull(),
  description: text('description').notNull(),
  resolved: text('resolved').notNull().default('false'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailId: uuid('email_id').notNull().references(() => emails.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  storageKey: text('storage_key').notNull(),
  fileSizeBytes: integer('file_size_bytes'),
  extractedText: text('extracted_text'),
  status: attachmentStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Email Integrations ───────────────────────────────────────────────────────

export const emailIntegrationProviderEnum = pgEnum('email_integration_provider', [
  'gmail',
  'outlook',
  'yahoo',
  'imap',
  'sendgrid',
  'postmark',
])

export const emailIntegrationStatusEnum = pgEnum('email_integration_status', [
  'active',
  'error',
  'pending',
])

export const teamEmailIntegrations = pgTable('team_email_integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  provider: emailIntegrationProviderEnum('provider').notNull(),
  label: text('label').notNull(),
  email: text('email'),
  imapHost: text('imap_host'),
  imapPort: integer('imap_port'),
  credentials: jsonb('credentials'),    // { password } for IMAP; null for webhook providers
  status: emailIntegrationStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TeamEmailIntegration = typeof teamEmailIntegrations.$inferSelect
export type NewTeamEmailIntegration = typeof teamEmailIntegrations.$inferInsert
export type EmailIntegrationProvider = 'gmail' | 'outlook' | 'yahoo' | 'imap' | 'sendgrid' | 'postmark'
export type EmailIntegrationStatus = 'active' | 'error' | 'pending'

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailId: uuid('email_id').notNull().references(() => emails.id, { onDelete: 'cascade' }),
  status: jobStatusEnum('status').notNull().default('pending'),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  retryAfter: timestamp('retry_after', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  purchaseOrders: many(purchaseOrders),
  emails: many(emails),
  emailIntegrations: many(teamEmailIntegrations),
}))

export const teamEmailIntegrationsRelations = relations(teamEmailIntegrations, ({ one }) => ({
  team: one(teams, { fields: [teamEmailIntegrations.teamId], references: [teams.id] }),
}))

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}))

export const usersRelations = relations(users, ({ many }) => ({
  teamMemberships: many(teamMembers),
}))

export const emailsRelations = relations(emails, ({ one, many }) => ({
  team: one(teams, { fields: [emails.teamId], references: [teams.id] }),
  parsedConfirmations: many(parsedConfirmations),
  jobs: many(jobs),
  attachments: many(attachments),
}))

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  team: one(teams, { fields: [purchaseOrders.teamId], references: [teams.id] }),
  parsedConfirmations: many(parsedConfirmations),
}))

export const parsedConfirmationsRelations = relations(parsedConfirmations, ({ one, many }) => ({
  email: one(emails, { fields: [parsedConfirmations.emailId], references: [emails.id] }),
  purchaseOrder: one(purchaseOrders, { fields: [parsedConfirmations.poId], references: [purchaseOrders.id] }),
  mismatches: many(mismatches),
}))

export const mismatchesRelations = relations(mismatches, ({ one }) => ({
  parsedConfirmation: one(parsedConfirmations, {
    fields: [mismatches.parsedConfirmationId],
    references: [parsedConfirmations.id],
  }),
}))

export const jobsRelations = relations(jobs, ({ one }) => ({
  email: one(emails, { fields: [jobs.emailId], references: [emails.id] }),
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  email: one(emails, { fields: [attachments.emailId], references: [emails.id] }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────

export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert

export type Email = typeof emails.$inferSelect
export type NewEmail = typeof emails.$inferInsert

export type ParsedConfirmation = typeof parsedConfirmations.$inferSelect
export type NewParsedConfirmation = typeof parsedConfirmations.$inferInsert

export type Mismatch = typeof mismatches.$inferSelect
export type NewMismatch = typeof mismatches.$inferInsert

export type AuditLog = typeof auditLogs.$inferSelect
export type Job = typeof jobs.$inferSelect

export type Attachment = typeof attachments.$inferSelect
export type NewAttachment = typeof attachments.$inferInsert

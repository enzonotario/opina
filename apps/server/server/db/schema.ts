import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('owner'),
  createdAt: integer('created_at').notNull(),
})

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  publicKey: text('public_key').notNull().unique(),
  allowedOrigins: text('allowed_origins').notNull().default('[]'),
  settings: text('settings').notNull().default('{}'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const surveys = sqliteTable('surveys', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Survey'),
  type: text('type').notNull(),
  question: text('question').notNull(),
  followUp: text('follow_up'),
  thanks: text('thanks'),
  appearance: text('appearance').notNull().default('{}'),
  trigger: text('trigger').notNull().default('{"type":"manual"}'),
  targeting: text('targeting').notNull().default('{}'),
  frequency: text('frequency').notNull().default('{"mode":"once"}'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const responses = sqliteTable(
  'responses',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    surveyId: text('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    score: integer('score'),
    comment: text('comment'),
    urlPath: text('url_path').notNull(),
    urlHost: text('url_host').notNull(),
    locale: text('locale'),
    device: text('device'),
    visitorId: text('visitor_id').notNull(),
    metadata: text('metadata').notNull().default('{}'),
    screenshotPath: text('screenshot_path'),
    createdAt: integer('created_at').notNull(),
  },
  table => [
    index('responses_project_created_idx').on(table.projectId, table.createdAt),
    index('responses_survey_created_idx').on(table.surveyId, table.createdAt),
    index('responses_project_path_idx').on(table.projectId, table.urlPath),
    index('responses_survey_visitor_created_idx').on(
      table.surveyId,
      table.visitorId,
      table.createdAt,
    ),
  ],
)

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const importJobs = sqliteTable(
  'import_jobs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    surveyId: text('survey_id').notNull(),
    status: text('status').notNull(),
    total: integer('total').notNull().default(0),
    processed: integer('processed').notNull().default(0),
    imported: integer('imported').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    errors: text('errors').notNull().default('[]'),
    errorMessage: text('error_message'),
    detected: text('detected'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  table => [
    index('import_jobs_project_created_idx').on(table.projectId, table.createdAt),
  ],
)


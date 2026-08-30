import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const mentors = pgTable('mentors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  designation: text('designation').notNull(),
  whatsapp: text('whatsapp').notNull(),
  universityName: text('university_name').notNull().default(''),
  universityLogo: text('university_logo').notNull().default(''),
  brandingLocked: boolean('branding_locked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  mentorId: text('mentor_id').notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  attachmentUrl: text('attachment_url').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const tests = pgTable('tests', {
  id: text('id').primaryKey(),
  mentorId: text('mentor_id').notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  course: text('course').notNull(),
  subject: text('subject').notNull(),
  semester: text('semester').notNull(),
  section: text('section').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  instructions: text('instructions').notNull().default(''),
  signatureUrl: text('signature_url').notNull().default(''),
  accessToken: text('access_token').notNull().unique(),
  linkExpiresAt: timestamp('link_expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  testId: text('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  options: jsonb('options').$type<string[]>().notNull(),
  correctIndex: integer('correct_index').notNull(),
  position: integer('position').notNull(),
})

export const attempts = pgTable('attempts', {
  id: text('id').primaryKey(),
  testId: text('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  studentName: text('student_name').notNull(),
  studentEmail: text('student_email').notNull(),
  whatsapp: text('whatsapp').notNull().default(''),
  deviceId: text('device_id').notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  timeSeconds: integer('time_seconds').notNull(),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
})

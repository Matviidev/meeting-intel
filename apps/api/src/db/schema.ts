import { sql } from 'drizzle-orm';
import {
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import type { Insights, SpeakerStat, Utterance } from '../domain/meeting.js';

export const EMBEDDING_DIMENSIONS = 384;

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: integer('number').notNull().unique(),
  title: text('title').notNull(),
  occurredOn: date('occurred_on'),
  sourceName: text('source_name').notNull(),
  content: text('content').notNull(),
  utterances: jsonb('utterances').$type<Utterance[]>().notNull(),
  durationSec: integer('duration_sec').notNull(),
  speakers: jsonb('speakers').$type<SpeakerStat[]>().notNull(),
  insights: jsonb('insights').$type<Insights>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    startSec: integer('start_sec').notNull(),
    endSec: integer('end_sec').notNull(),
    speakers: text('speakers').array().notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    tsv: tsvector('tsv').generatedAlwaysAs(sql`to_tsvector('english', content)`),
  },
  (t) => [
    index('chunks_meeting_idx').on(t.meetingId),
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('chunks_tsv_idx').using('gin', t.tsv),
    index('chunks_speakers_idx').using('gin', t.speakers),
  ],
);

export const actionItems = pgTable(
  'action_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    owner: text('owner'),
    task: text('task').notNull(),
    due: text('due'),
    atSec: integer('at_sec'),
    status: text('status', { enum: ['open', 'done'] })
      .notNull()
      .default('open'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('action_items_meeting_idx').on(t.meetingId)],
);

export const traces = pgTable('traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  scope: jsonb('scope').$type<number[]>().notNull(),
  retrieved: jsonb('retrieved').$type<RetrievedTrace[]>().notNull(),
  answer: text('answer').notNull().default(''),
  flags: jsonb('flags').$type<string[]>().notNull(),
  model: text('model').notNull(),
  latencyMs: integer('latency_ms'),
  firstTokenMs: integer('first_token_ms'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  feedback: real('feedback'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const schemaMigrations = pgTable('schema_migrations', {
  name: text('name').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface RetrievedTrace {
  label: string;
  chunkId: string;
  range: string;
  score: number;
  vectorRank: number | null;
  keywordRank: number | null;
  speakerRank: number | null;
}

export type MeetingRow = typeof meetings.$inferSelect;
export type ChunkRow = typeof chunks.$inferSelect;
export type ActionItemRow = typeof actionItems.$inferSelect;
export type TraceRow = typeof traces.$inferSelect;

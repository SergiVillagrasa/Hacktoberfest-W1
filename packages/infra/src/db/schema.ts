import { index, integer, jsonb, pgTable, bigserial, boolean, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import type { TargetAssets } from '@snaphunt/core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  status: text('status').notNull(),
  phase: text('phase').notNull(),
  timeLimitMs: integer('time_limit_ms').notNull(),
  countdownEndsAt: ts('countdown_ends_at'),
  endsAt: ts('ends_at'),
  finishedAt: ts('finished_at'),
  version: integer('version').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  nickname: text('nickname').notNull(),
  isCreator: boolean('is_creator').notNull().default(false),
  status: text('status').notNull(),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  tokenHash: text('token_hash').notNull().unique(),
  joinedAt: ts('joined_at').notNull().defaultNow(),
});

export const targets = pgTable(
  'targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    imagePath: text('image_path').notNull(),
    validation: text('validation').notNull(),
    rejectReason: text('reject_reason'),
    foundBy: uuid('found_by').references(() => players.id),
    foundAt: ts('found_at'),
    points: integer('points'),
    assets: jsonb('assets').$type<TargetAssets>().notNull(),
  },
  (t) => [unique('targets_room_owner_unique').on(t.roomId, t.ownerId)],
);

export const clues = pgTable('clues', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull().references(() => targets.id, { onDelete: 'cascade' }),
  hunterId: uuid('hunter_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  issuedAt: ts('issued_at').notNull(),
  secondClueUsed: boolean('second_clue_used').notNull().default(false),
  judgeBusyServed: boolean('judge_busy_served').notNull().default(false),
  status: text('status').notNull(),
});

export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  clueId: uuid('clue_id').notNull().references(() => clues.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  imagePath: text('image_path').notNull(),
  outcome: text('outcome').notNull(),
  evidence: jsonb('evidence'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    at: ts('at').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
  },
  (t) => [index('events_room_id_idx').on(t.roomId, t.id)],
);

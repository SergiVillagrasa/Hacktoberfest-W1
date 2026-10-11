import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, expect, test } from 'vitest';
import type { Game, StoredSubmission } from '@snaphunt/core';
import { createGameRepository } from '../src/db/game-repository';
import { createSubmissionRepository } from '../src/db/submission-repository';
import * as schema from '../src/db/schema';

const T0 = new Date('2026-10-11T10:00:00.000Z');
const id = () => crypto.randomUUID();
let repo: ReturnType<typeof createSubmissionRepository>;
let sub: StoredSubmission;

beforeEach(async () => {
  const db = drizzle(new PGlite(), { schema }) as never;
  await migrate(db, { migrationsFolder: new URL('../src/db/migrations', import.meta.url).pathname });
  const [a, b, ta, tb, clue] = [id(), id(), id(), id(), id()];
  const assets = { prep: 'pending' as const, clues: null, audio: { first: null, second: null, visual: null, judgeBusy: null }, hintPath: null };
  const game: Game = {
    roomId: id(), code: 'ABCDE', status: 'active', phase: 'races', timeLimitMs: 600_000, countdownEndsAt: T0, endsAt: T0, finishedAt: null, version: 0,
    players: [a, b].map((pid, i) => ({ id: pid, nickname: `P${i}`, isCreator: i === 0, status: 'active' as const, failedAttempts: 0, joinedAt: T0 })),
    targets: [ta, tb].map((tid, i) => ({ id: tid, ownerId: [a, b][i]!, imagePath: `${tid}.jpg`, validation: 'accepted' as const, rejectReason: null, foundBy: null, foundAt: null, points: null, assets })),
    clues: [{ id: clue, targetId: tb, hunterId: a, kind: 'voice', issuedAt: T0, secondClueUsed: false, judgeBusyServed: false, status: 'active' }],
  };
  await createGameRepository(db).create(game, { [a]: 'h1', [b]: 'h2' });
  repo = createSubmissionRepository(db);
  sub = { id: id(), roomId: game.roomId, clueId: clue, playerId: a, idempotencyKey: id(), imagePath: 's.jpg', outcome: 'match', points: 850, evidence: { sameObject: true }, createdAt: T0 };
});

test('record then findByKey round-trips including points and evidence', async () => {
  expect(await repo.findByKey(sub.idempotencyKey)).toBeNull();
  await repo.record(sub);
  expect(await repo.findByKey(sub.idempotencyKey)).toEqual(sub);
});

test('recording the same idempotency key twice keeps the first result', async () => {
  await repo.record(sub);
  await repo.record({ ...sub, id: id(), outcome: 'no_match', points: null });
  expect(await repo.findByKey(sub.idempotencyKey)).toMatchObject({ outcome: 'match', points: 850 });
});

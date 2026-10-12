import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, test } from 'vitest';
import type { Game, StoredSubmission } from '@snaphunt/core';
import { createGameRepository } from '../src/db/game-repository';
import { createSubmissionRepository } from '../src/db/submission-repository';
import * as schema from '../src/db/schema';

const T0 = new Date('2026-10-11T10:00:00.000Z');
const id = () => crypto.randomUUID();

function makeGame(): Game {
  const [a, b] = [id(), id()];
  const assets = { prep: 'ready' as const, clues: { first: 'f', second: 's', visual: 'v', judgeBusy: 'j' }, audio: { first: 'a.mp3', second: null, visual: null, judgeBusy: null }, hintPath: 'h.webp' };
  const ta = id();
  const tb = id();
  return {
    roomId: id(),
    code: 'ABCDE',
    status: 'active',
    phase: 'races',
    timeLimitMs: 600_000,
    countdownEndsAt: T0,
    endsAt: new Date(T0.getTime() + 600_000),
    finishedAt: null,
    version: 0,
    players: [
      { id: a, nickname: 'Ann', isCreator: true, status: 'active', failedAttempts: 1, joinedAt: T0 },
      { id: b, nickname: 'Bob', isCreator: false, status: 'active', failedAttempts: 0, joinedAt: new Date(T0.getTime() + 1000) },
    ],
    targets: [
      { id: ta, ownerId: a, imagePath: 'ta.jpg', validation: 'accepted', rejectReason: null, foundBy: null, foundAt: null, points: null, assets },
      { id: tb, ownerId: b, imagePath: 'tb.jpg', validation: 'accepted', rejectReason: null, foundBy: a, foundAt: new Date(T0.getTime() + 5000), points: 900, assets },
    ],
    clues: [{ id: id(), targetId: tb, hunterId: a, kind: 'voice', issuedAt: T0, secondClueUsed: true, judgeBusyServed: false, status: 'won' }],
  };
}

let repo: ReturnType<typeof createGameRepository>;
let db: Parameters<typeof createSubmissionRepository>[0];
let game: Game;
let hashes: Record<string, string>;

beforeEach(async () => {
  const client = drizzle(new PGlite(), { schema });
  await migrate(client, { migrationsFolder: new URL('../src/db/migrations', import.meta.url).pathname });
  db = client as never;
  repo = createGameRepository(db);
  game = makeGame();
  hashes = { [game.players[0]!.id]: 'hash-a', [game.players[1]!.id]: 'hash-b' };
  await repo.create(game, hashes);
});

describe('game repository', () => {
  test('create then loadByCode round-trips every field', async () => {
    expect(await repo.loadByCode('ABCDE')).toEqual(game);
    expect(await repo.loadByCode('ZZZZZ')).toBeNull();
  });

  test('create reports a taken room code without writing anything', async () => {
    const other = { ...makeGame(), code: 'ABCDE' };
    const otherHashes = { [other.players[0]!.id]: 'x1', [other.players[1]!.id]: 'x2' };
    expect(await repo.create(other, otherHashes)).toBe(false);
    expect(await repo.loadByCode('ABCDE')).toEqual(game);
    expect(await repo.findPlayerByTokenHash('x1')).toBeNull();
    expect(await repo.create({ ...other, code: 'FGHJK' }, otherHashes)).toBe(true);
  });

  test('save bumps the version, persists changes and appends events', async () => {
    const changed: Game = { ...game, phase: 'solo', players: [{ ...game.players[0]!, failedAttempts: 2 }, game.players[1]!] };
    const saved = await repo.save(changed, [{ type: 'solo_mode', at: T0 }]);
    expect(saved.version).toBe(1);
    expect(await repo.version('ABCDE')).toBe(1);
    const loaded = await repo.loadByCode('ABCDE');
    expect(loaded).toMatchObject({ phase: 'solo', version: 1 });
    expect(loaded!.players[0]!.failedAttempts).toBe(2);
    expect(await repo.recentEvents(game.roomId, 10)).toMatchObject([{ type: 'solo_mode', at: T0 }]);
  });

  test('save with a stale version throws version_conflict and writes nothing', async () => {
    await repo.save(game, []);
    const stale: Game = { ...game, phase: 'solo' };
    await expect(repo.save(stale, [{ type: 'solo_mode', at: T0 }])).rejects.toMatchObject({ code: 'version_conflict' });
    expect(await repo.loadByCode('ABCDE')).toMatchObject({ phase: 'races', version: 1 });
    expect(await repo.recentEvents(game.roomId, 10)).toEqual([]);
  });

  test('two concurrent saves from the same version: exactly one wins', async () => {
    const results = await Promise.allSettled([
      repo.save({ ...game, phase: 'solo' }, [{ type: 'solo_mode', at: T0 }]),
      repo.save({ ...game, status: 'finished' }, [{ type: 'game_finished', at: T0, reason: 'time_up' }]),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await repo.version('ABCDE')).toBe(1);
    expect(await repo.recentEvents(game.roomId, 10)).toHaveLength(1);
  });

  test('findPlayerByTokenHash finds the player; saving without tokens keeps them', async () => {
    await repo.save(game, []);
    expect(await repo.findPlayerByTokenHash('hash-b')).toEqual({ roomCode: 'ABCDE', playerId: game.players[1]!.id });
    expect(await repo.findPlayerByTokenHash('nope')).toBeNull();
  });

  test('a clue judgement round-trips through save and load, pending and final', async () => {
    const judgement = { id: 's1', idempotencyKey: 'k1', imagePath: 's.jpg', startedAt: 1, expiresAt: 2, result: null };
    const pending: Game = { ...game, clues: [{ ...game.clues[0]!, judgement }] };
    await repo.save(pending, []);
    expect((await repo.loadByCode('ABCDE'))!.clues[0]!.judgement).toEqual(judgement);
    const final = { ...judgement, result: { outcome: 'match' as const, submissionId: 's1', pending: false, points: 900, attemptsLeft: 5, message: 'You found it!' } };
    const done = { ...(await repo.loadByCode('ABCDE'))!, clues: [{ ...game.clues[0]!, judgement: final }] };
    await repo.save(done, []);
    expect((await repo.loadByCode('ABCDE'))!.clues[0]!.judgement).toEqual(final);
  });

  test('save records submissions atomically and a conflict writes no row', async () => {
    const subs = createSubmissionRepository(db);
    const sub = (key: string, outcome: StoredSubmission['outcome'] = 'pending'): StoredSubmission => ({
      id: id(), roomId: game.roomId, clueId: game.clues[0]!.id, playerId: game.players[0]!.id, idempotencyKey: key, imagePath: 's.jpg', outcome, points: null, evidence: null, createdAt: T0,
    });
    await repo.save(game, [], {}, [sub('k1')]);
    expect(await subs.findByKey('k1')).toMatchObject({ outcome: 'pending', clueId: game.clues[0]!.id });
    const stale: Game = { ...game, version: 99 };
    await expect(repo.save(stale, [], {}, [sub('k2')])).rejects.toMatchObject({ code: 'version_conflict' });
    expect(await subs.findByKey('k2')).toBeNull();
  });

  test('a submission update on the same key and owner applies; a different owner is forbidden and rolls back', async () => {
    const subs = createSubmissionRepository(db);
    const stored = (await repo.loadByCode('ABCDE'))!;
    const base: StoredSubmission = {
      id: id(), roomId: stored.roomId, clueId: stored.clues[0]!.id, playerId: stored.players[0]!.id, idempotencyKey: 'k9', imagePath: 's.jpg', outcome: 'pending', points: null, evidence: null, createdAt: T0,
    };
    await repo.save(stored, [], {}, [base]);
    const v1 = (await repo.loadByCode('ABCDE'))!;
    await repo.save(v1, [], {}, [{ ...base, outcome: 'match', points: 900, evidence: { sameObject: true } }]);
    expect(await subs.findByKey('k9')).toMatchObject({ outcome: 'match', points: 900, imagePath: 's.jpg' });
    const v2 = (await repo.loadByCode('ABCDE'))!;
    await expect(repo.save(v2, [], {}, [{ ...base, id: id(), playerId: stored.players[1]!.id, outcome: 'no_match' }])).rejects.toMatchObject({ code: 'forbidden' });
    expect(await repo.version('ABCDE')).toBe(v2.version);
    expect(await subs.findByKey('k9')).toMatchObject({ outcome: 'match', points: 900 });
  });

  test('new players need a token and removed players disappear', async () => {
    const joiner = { id: id(), nickname: 'Cy', isCreator: false, status: 'active' as const, failedAttempts: 0, joinedAt: new Date(T0.getTime() + 2000) };
    await repo.save({ ...game, players: [...game.players, joiner] }, [], { [joiner.id]: 'hash-c' });
    expect((await repo.loadByCode('ABCDE'))!.players).toHaveLength(3);
    const kept = (await repo.loadByCode('ABCDE'))!;
    await repo.save({ ...kept, players: kept.players.filter((p) => p.id !== joiner.id) }, []);
    expect((await repo.loadByCode('ABCDE'))!.players).toHaveLength(2);
    expect(await repo.findPlayerByTokenHash('hash-c')).toBeNull();
  });
});

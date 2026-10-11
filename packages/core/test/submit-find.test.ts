import { describe, expect, test, vi } from 'vitest';
import { createMemoryGameRepository, createMemorySubmissionRepository, seededRng, submitFind, type FindDeps, type Game, type GameError, type ImageStore, type MatchEvidence } from '../src';
import { T0, makeClue, makeGame, makePlayer, makeTarget } from './fixtures';

const JPEG = new Uint8Array([0xff, 0xd8, 1]);
const evidence = (sameObject: boolean, confidence = 0.95): MatchEvidence => ({ sameObject, confidence, matchingFeatures: [], differences: [] });
const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e: GameError) => e))?.code ?? null);

async function setup(opts: { compare?: FindDeps['vision']['compare']; game?: Partial<Game>; judgeBudgetMs?: number } = {}) {
  let n = 0;
  const games = createMemoryGameRepository();
  const submissions = createMemorySubmissionRepository();
  const files = new Map<string, Uint8Array>();
  const images: ImageStore = { put: async (p, b) => void files.set(p, b), get: async () => new Uint8Array([7]), signedUrl: async (p) => p };
  const compare = vi.fn(opts.compare ?? (async () => evidence(true)));
  const deps: FindDeps = {
    games, submissions, images,
    vision: { compare, validateTarget: async () => ({ accepted: true, reason: null, label: '' }), writeClues: async () => ({ first: '', second: '', visual: '', judgeBusy: '' }) },
    now: () => new Date(T0.getTime() + 60_000), rng: seededRng(2), newId: () => `n${++n}`, judgeBudgetMs: opts.judgeBudgetMs,
  };
  const game = makeGame({
    code: 'ABCDE', version: 0,
    players: ['a', 'b', 'c'].map((id) => makePlayer(id)),
    targets: ['a', 'b', 'c'].map((id) => makeTarget(`t${id}`, id)),
    clues: [makeClue('ca', 'tb', 'a'), makeClue('cb', 'tc', 'b'), makeClue('cc', 'ta', 'c')],
    ...opts.game,
  });
  await games.create(game, {});
  const submit = (playerId: string, clueId: string, key = crypto.randomUUID()) => submitFind(deps, { code: 'ABCDE', playerId, clueId, bytes: JPEG, idempotencyKey: key });
  return { deps, games, submissions, files, compare, submit };
}

describe('submitFind', () => {
  test('a match scores the find and returns its points', async () => {
    const s = await setup();
    const res = await s.submit('a', 'ca');
    expect(res).toMatchObject({ outcome: 'match', points: 900, attemptsLeft: 5, message: 'You found it!' });
    const game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.targets.find((t) => t.id === 'tb')).toMatchObject({ foundBy: 'a', points: 900 });
    expect(s.submissions.all).toMatchObject([{ outcome: 'match', points: 900, playerId: 'a' }]);
    expect([...s.files.keys()].some((p) => p.includes('/submissions/'))).toBe(true);
  });

  test('a low-confidence or different object counts as one failed attempt', async () => {
    const s = await setup({ compare: async () => evidence(true, 0.5) });
    expect(await s.submit('a', 'ca')).toMatchObject({ outcome: 'no_match', attemptsLeft: 4 });
    const other = await setup({ compare: async () => evidence(false, 0.99) });
    expect(await other.submit('a', 'ca')).toMatchObject({ outcome: 'no_match', attemptsLeft: 4 });
  });

  test('the fifth miss takes the player out and a sixth submission is rejected', async () => {
    const s = await setup({ compare: async () => evidence(false) });
    for (let i = 0; i < 4; i++) await s.submit('a', 'ca');
    expect(await s.submit('a', 'ca')).toMatchObject({ outcome: 'no_match', attemptsLeft: 0 });
    expect((await s.games.loadByCode('ABCDE'))!.players[0]!.status).toBe('out_of_attempts');
    expect(await code(s.submit('a', 'ca'))).toBe('not_active_player');
  });

  test('the same idempotency key returns the same result with one score and no new attempt', async () => {
    const s = await setup();
    const key = crypto.randomUUID();
    const first = await s.submit('a', 'ca', key);
    const again = await s.submit('a', 'ca', key);
    expect(again).toEqual(first);
    expect(s.compare).toHaveBeenCalledTimes(1);
    expect(s.submissions.all).toHaveLength(1);
    const miss = await setup({ compare: async () => evidence(false) });
    const k2 = crypto.randomUUID();
    await miss.submit('a', 'ca', k2);
    expect(await miss.submit('a', 'ca', k2)).toMatchObject({ attemptsLeft: 4 });
    expect(await code(s.submit('b', 'cb', key))).toBe('forbidden');
  });

  test('two correct photos for the same target at once: one match, one already_found, attempts untouched', async () => {
    const s = await setup({ game: { clues: [makeClue('ca', 'tc', 'a'), makeClue('vb', 'tc', 'b', { kind: 'visual' }), makeClue('cc', 'ta', 'c')] } });
    const [x, y] = await Promise.all([s.submit('a', 'ca'), s.submit('b', 'vb')]);
    expect([x.outcome, y.outcome].sort()).toEqual(['already_found', 'match']);
    const loser = x.outcome === 'already_found' ? x : y;
    expect(loser.attemptsLeft).toBe(5);
    expect((await s.games.loadByCode('ABCDE'))!.targets.filter((t) => t.foundBy).length).toBe(1);
    expect(s.submissions.all.filter((r) => r.outcome === 'match')).toHaveLength(1);
  });

  test('a judge that exceeds its budget gives a bonus clue and costs no attempt', async () => {
    const s = await setup({ compare: () => new Promise(() => {}), judgeBudgetMs: 30 });
    expect(await s.submit('a', 'ca')).toMatchObject({ outcome: 'judge_busy', attemptsLeft: 5, message: expect.stringContaining('bonus clue') });
    const game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.clues[0]).toMatchObject({ judgeBusyServed: true, status: 'active' });
    expect(game.players[0]!.failedAttempts).toBe(0);
    const failing = await setup({ compare: async () => Promise.reject(new Error('500')) });
    expect(await failing.submit('a', 'ca')).toMatchObject({ outcome: 'judge_busy', attemptsLeft: 5 });
  });

  test('submissions for an already found target, a finished game or someone else\'s clue are rejected without an attempt', async () => {
    const s = await setup();
    await s.submit('a', 'ca');
    const late = await s.submit('c', 'cc').then(() => null, (e: GameError) => e.code);
    expect(late).toBeNull();
    const taken = await setup({ game: { targets: ['a', 'b', 'c'].map((id) => makeTarget(`t${id}`, id, id === 'b' ? { foundBy: 'c', foundAt: T0, points: 500 } : {})) } });
    expect(await taken.submit('a', 'ca')).toMatchObject({ outcome: 'already_found', attemptsLeft: 5 });
    expect(taken.compare).not.toHaveBeenCalled();
    const over = await setup({ game: { status: 'finished' } });
    expect(await code(over.submit('a', 'ca'))).toBe('clue_not_active');
    expect(await code((await setup()).submit('a', 'cb'))).toBe('forbidden');
  });

  test('a time-up game finishes lazily and rejects the submission', async () => {
    const s = await setup({ game: { endsAt: new Date(T0.getTime() + 1000) } });
    expect(await code(s.submit('a', 'ca'))).toBe('clue_not_active');
    expect((await s.games.loadByCode('ABCDE'))!.status).toBe('finished');
  });
});

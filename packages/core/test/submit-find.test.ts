import { describe, expect, test, vi } from 'vitest';
import { createMemoryGameRepository, createMemorySubmissionRepository, seededRng, submitFind, tick, type FindDeps, type Game, type GameError, type ImageStore, type MatchEvidence } from '../src';
import { T0, makeClue, makeGame, makePlayer, makeTarget } from './fixtures';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 1]);
const evidence = (sameObject: boolean, confidence = 0.95): MatchEvidence => ({ sameObject, confidence, matchingFeatures: [], differences: [] });
const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e: GameError) => e))?.code ?? null);
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e?: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};
const waitUntil = async (check: () => Promise<void> | void) => {
  for (let i = 0; i < 200; i++) {
    try {
      await check();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  await check();
};

async function setup(opts: { compare?: FindDeps['vision']['compare']; game?: Partial<Game>; judgeBudgetMs?: number; judgeHardBudgetMs?: number; background?: FindDeps['background']; beforePut?: (bytes: Uint8Array) => Promise<void>; get?: ImageStore['get'] } = {}) {
  let n = 0;
  let now = T0.getTime() + 60_000;
  const submissions = createMemorySubmissionRepository();
  const games = createMemoryGameRepository(submissions.all);
  const files = new Map<string, Uint8Array>();
  const images: ImageStore = { put: async (p, b) => (await opts.beforePut?.(b), void files.set(p, b)), get: opts.get ?? (async () => new Uint8Array([7])), signedUrl: async (p) => p };
  const compare = vi.fn(opts.compare ?? (async () => evidence(true)));
  const deps: FindDeps = {
    games, submissions, images,
    vision: { compare, validateTarget: async () => ({ accepted: true, reason: null, label: '' }), writeClues: async () => ({ first: '', second: '', visual: '', judgeBusy: '' }) },
    now: () => new Date(now), rng: seededRng(2), newId: () => `n${++n}`, judgeBudgetMs: opts.judgeBudgetMs, judgeHardBudgetMs: opts.judgeHardBudgetMs,
    background: opts.background ?? ((task) => void task()),
  };
  const game = makeGame({
    code: 'ABCDE', version: 0,
    players: ['a', 'b', 'c'].map((id) => makePlayer(id)),
    targets: ['a', 'b', 'c'].map((id) => makeTarget(`t${id}`, id)),
    clues: [makeClue('ca', 'tb', 'a'), makeClue('cb', 'tc', 'b'), makeClue('cc', 'ta', 'c')],
    ...opts.game,
  });
  await games.create(game, {});
  const submit = (playerId: string, clueId: string, key = crypto.randomUUID(), bytes = JPEG) => submitFind(deps, { code: 'ABCDE', playerId, clueId, bytes, idempotencyKey: key });
  return { deps, games, submissions, files, compare, submit, setNow: (ms: number) => void (now = ms) };
}

describe('submitFind', () => {
  test('a match scores the find and returns its points', async () => {
    const s = await setup();
    const res = await s.submit('a', 'ca');
    expect(res).toMatchObject({ outcome: 'match', points: 900, attemptsLeft: 5, message: 'You found it!', pending: false });
    expect(res.submissionId).toBeTruthy();
    const game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.targets.find((t) => t.id === 'tb')).toMatchObject({ foundBy: 'a', points: 900 });
    expect(s.submissions.all).toMatchObject([{ outcome: 'match', points: 900, playerId: 'a' }]);
    expect([...s.files.keys()].some((p) => p.includes('/submissions/'))).toBe(true);
  });

  test('non-image bytes are rejected before storing anything or calling the judge', async () => {
    const s = await setup();
    const err = await s.submit('a', 'ca', crypto.randomUUID(), new Uint8Array([1, 2, 3])).then(() => null, (e: GameError) => e);
    expect(err).toMatchObject({ code: 'invalid_state', message: 'Please send a JPEG, PNG or WebP photo' });
    expect([...s.files.keys()].some((p) => p.includes('/submissions/'))).toBe(false);
    expect(s.compare).not.toHaveBeenCalled();
    expect(s.submissions.all).toHaveLength(0);
    expect((await s.games.loadByCode('ABCDE'))!.players[0]!.failedAttempts).toBe(0);
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

  test('a judge that passes the soft deadline reports pending, serves the bonus clue and keeps judging', async () => {
    const gate = deferred<MatchEvidence>();
    let seenSignal: AbortSignal | undefined;
    const s = await setup({ compare: (_r, _c, signal) => ((seenSignal = signal), gate.promise), judgeBudgetMs: 20 });
    const res = await s.submit('a', 'ca');
    expect(res).toMatchObject({ outcome: 'judge_busy', pending: true, attemptsLeft: 5 });
    expect(res.message).toContain('keep checking');
    expect(res.submissionId).toBeTruthy();
    expect(seenSignal!.aborted).toBe(false);
    const game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.clues[0]).toMatchObject({ judgeBusyServed: true, status: 'active' });
    expect(game.clues[0]!.judgement).toMatchObject({ id: res.submissionId, result: null });
    expect(game.players[0]!.failedAttempts).toBe(0);
    expect(s.submissions.all).toMatchObject([{ outcome: 'pending', clueId: 'ca', playerId: 'a' }]);
    gate.resolve(evidence(true));
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('match'));
  });

  test('a verdict that lands after the response applies once: match scores, a miss charges one attempt', async () => {
    const gate = deferred<MatchEvidence>();
    const s = await setup({ compare: () => gate.promise, judgeBudgetMs: 20 });
    await s.submit('a', 'ca');
    gate.resolve(evidence(true));
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('match'));
    let game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.targets.find((t) => t.id === 'tb')).toMatchObject({ foundBy: 'a', points: 900 });
    expect(game.clues[0]!.judgement!.result).toMatchObject({ outcome: 'match', pending: false });
    expect(game.players[0]!.failedAttempts).toBe(0);
    expect(s.submissions.all).toMatchObject([{ outcome: 'match', points: 900 }]);
    expect(s.compare).toHaveBeenCalledTimes(1);

    const miss = deferred<MatchEvidence>();
    const m = await setup({ compare: () => miss.promise, judgeBudgetMs: 20 });
    await m.submit('a', 'ca');
    miss.resolve(evidence(false));
    await waitUntil(async () => expect((await m.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('no_match'));
    game = (await m.games.loadByCode('ABCDE'))!;
    expect(game.players[0]!.failedAttempts).toBe(1);
    expect(m.submissions.all).toMatchObject([{ outcome: 'no_match', points: null }]);
  });

  test('a judge that passes the hard deadline ends the submission as busy and frees the clue for a fresh key', async () => {
    const gate = deferred<MatchEvidence>();
    let seenSignal: AbortSignal | undefined;
    const s = await setup({ compare: (_r, _c, signal) => ((seenSignal = signal), gate.promise), judgeBudgetMs: 20, judgeHardBudgetMs: 40 });
    const res = await s.submit('a', 'ca');
    expect(res).toMatchObject({ outcome: 'judge_busy', pending: true });
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('judge_busy'));
    expect(seenSignal!.aborted).toBe(true);
    let game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.clues[0]!.judgement!.result).toMatchObject({ outcome: 'judge_busy', pending: false, message: expect.stringContaining('try again') });
    expect(game.players[0]!.failedAttempts).toBe(0);
    expect(s.submissions.all).toMatchObject([{ outcome: 'judge_busy', points: null }]);

    s.compare.mockImplementation(async () => evidence(true));
    expect(await s.submit('a', 'ca', crypto.randomUUID())).toMatchObject({ outcome: 'match', pending: false });
    game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.targets.find((t) => t.id === 'tb')).toMatchObject({ foundBy: 'a' });

    gate.resolve(evidence(false));
    await new Promise((r) => setTimeout(r, 10));
    game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.clues[0]!.judgement!.result!.outcome).toBe('match');
    expect(game.players[0]!.failedAttempts).toBe(0);
    expect(s.submissions.all.filter((r2) => r2.outcome === 'match')).toHaveLength(1);
  });

  test('concurrent submissions for one clue reserve once and judge once', async () => {
    const gate = deferred<MatchEvidence>();
    const s = await setup({ compare: () => gate.promise, judgeBudgetMs: 20 });
    const key = crypto.randomUUID();
    const [x, y, z] = await Promise.all([s.submit('a', 'ca', key), s.submit('a', 'ca', key), s.submit('a', 'ca', crypto.randomUUID())]);
    expect(s.compare).toHaveBeenCalledTimes(1);
    for (const res of [x, y, z]) expect(res).toMatchObject({ outcome: 'judge_busy', pending: true });
    gate.resolve(evidence(false));
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('no_match'));
    expect((await s.games.loadByCode('ABCDE'))!.players[0]!.failedAttempts).toBe(1);
    expect(s.submissions.all).toHaveLength(1);
  });

  test('another photo while the judge is still working reports the pending submission without uploading or judging', async () => {
    const gate = deferred<MatchEvidence>();
    const s = await setup({ compare: () => gate.promise, judgeBudgetMs: 20 });
    const first = await s.submit('a', 'ca');
    const uploads = s.files.size;
    const again = await s.submit('a', 'ca', crypto.randomUUID());
    expect(again).toMatchObject({ outcome: 'judge_busy', pending: true, submissionId: first.submissionId });
    expect(s.files.size).toBe(uploads);
    expect(s.compare).toHaveBeenCalledTimes(1);
    gate.resolve(evidence(true));
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('match'));
  });

  test('a same-key retry that finishes uploading after a fast match returns the original result', async () => {
    const JPEG2 = new Uint8Array([0xff, 0xd8, 0xff, 2]);
    const gate = deferred<void>();
    const s = await setup({ beforePut: async (b) => void (b === JPEG2 && (await gate.promise)) });
    const key = crypto.randomUUID();
    const retry = s.submit('a', 'ca', key, JPEG2);
    await new Promise((r) => setTimeout(r, 0));
    const first = await s.submit('a', 'ca', key);
    expect(first).toMatchObject({ outcome: 'match', pending: false, points: 900 });
    gate.resolve();
    expect(await retry).toEqual(first);
    expect(s.compare).toHaveBeenCalledTimes(1);
    expect(s.submissions.all).toMatchObject([{ outcome: 'match', idempotencyKey: key }]);
  });

  test('an idempotency key is scoped to its player, clue and room', async () => {
    const s = await setup({ game: { clues: [makeClue('ca', 'tb', 'a'), makeClue('cx', 'tc', 'a'), makeClue('cb', 'ta', 'b')] } });
    const key = crypto.randomUUID();
    await s.submit('a', 'ca', key);
    const files = s.files.size;
    expect(await code(s.submit('b', 'cb', key))).toBe('forbidden');
    expect(await code(s.submit('a', 'cx', key))).toBe('forbidden');
    await s.games.create(makeGame({ code: 'FGHIJ', roomId: 'room-2', players: [makePlayer('x')], targets: [makeTarget('tx', 'x')], clues: [makeClue('cx', 'tx', 'x')] }), {});
    expect(await code(submitFind(s.deps, { code: 'FGHIJ', playerId: 'x', clueId: 'cx', bytes: JPEG, idempotencyKey: key }))).toBe('forbidden');
    expect(s.files.size).toBe(files);
    expect(s.compare).toHaveBeenCalledTimes(1);
  });

  test('a slow upload that finishes after the hunt ended never reserves or judges', async () => {
    const JPEG2 = new Uint8Array([0xff, 0xd8, 0xff, 2]);
    const gate = deferred<void>();
    const endsAt = new Date(T0.getTime() + 60_000 + 5_000);
    const s = await setup({ game: { endsAt }, beforePut: async (b) => void (b === JPEG2 && (await gate.promise)) });
    const pending = s.submit('a', 'ca', crypto.randomUUID(), JPEG2);
    await new Promise((r) => setTimeout(r, 0));
    s.setNow(endsAt.getTime() + 1);
    gate.resolve();
    await expect(pending).rejects.toMatchObject({ code: 'clue_not_active' });
    const game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.status).toBe('finished');
    expect(game.clues[0]!.judgement).toBeUndefined();
    expect(s.submissions.all).toHaveLength(0);
    expect(s.compare).not.toHaveBeenCalled();
    expect(game.players[0]!.failedAttempts).toBe(0);
  });

  test('a verdict that lands after its persisted expiry ends busy even while the hunt still runs', async () => {
    const gate = deferred<MatchEvidence>();
    const s = await setup({ compare: () => gate.promise, judgeBudgetMs: 20, judgeHardBudgetMs: 30_000 });
    const res = await s.submit('a', 'ca');
    expect(res.pending).toBe(true);
    s.setNow(T0.getTime() + 60_000 + 30_000 + 5000 + 1);
    gate.resolve(evidence(true));
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('judge_busy'));
    const game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.status).toBe('active');
    expect(game.clues[0]!.judgement!.result!.message).toContain('try again');
    expect(game.targets.find((t) => t.id === 'tb')!.foundBy).toBeNull();
    expect(game.players[0]!.failedAttempts).toBe(0);
  });

  test('a reference photo that resolves after the hard deadline never reaches the judge', async () => {
    const getGate = deferred<Uint8Array>();
    const s = await setup({ get: () => getGate.promise, judgeBudgetMs: 20, judgeHardBudgetMs: 40 });
    const res = await s.submit('a', 'ca');
    expect(res.pending).toBe(true);
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('judge_busy'));
    getGate.resolve(new Uint8Array([9]));
    await new Promise((r) => setTimeout(r, 20));
    expect(s.compare).not.toHaveBeenCalled();
    expect((await s.games.loadByCode('ABCDE'))!.players[0]!.failedAttempts).toBe(0);
  });

  test('replaying a hard-busy key after a later verdict returns the terminal retry message', async () => {
    const gate = deferred<MatchEvidence>();
    const s = await setup({ compare: () => gate.promise, judgeBudgetMs: 20, judgeHardBudgetMs: 40 });
    const key = crypto.randomUUID();
    const res = await s.submit('a', 'ca', key);
    expect(res.pending).toBe(true);
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('judge_busy'));
    s.compare.mockImplementation(async () => evidence(false));
    await s.submit('a', 'ca', crypto.randomUUID());
    const replay = await s.submit('a', 'ca', key);
    expect(replay).toMatchObject({ outcome: 'judge_busy', pending: false });
    expect(replay.message).toContain('try again');
    expect(replay.message).not.toContain('keep checking');
  });

  test('a verdict that lands after a rival found the target or the game moved on scores nothing', async () => {
    const gate = deferred<MatchEvidence>();
    const s = await setup({ compare: () => gate.promise, judgeBudgetMs: 20 });
    await s.submit('a', 'ca');
    let game = (await s.games.loadByCode('ABCDE'))!;
    await s.games.save({ ...game, targets: game.targets.map((t) => (t.id === 'tb' ? { ...t, foundBy: 'b', foundAt: new Date(), points: 500 } : t)) }, []);
    gate.resolve(evidence(true));
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('already_found'));
    game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.targets.find((t) => t.id === 'tb')).toMatchObject({ foundBy: 'b', points: 500 });
    expect(game.players[0]!.failedAttempts).toBe(0);
    expect(s.submissions.all).toMatchObject([{ outcome: 'already_found', points: null }]);

    const gate2 = deferred<MatchEvidence>();
    const e = await setup({ compare: () => gate2.promise, judgeBudgetMs: 20 });
    await e.submit('a', 'ca');
    game = (await e.games.loadByCode('ABCDE'))!;
    await e.games.save(
      { ...game, players: game.players.map((p) => (p.id === 'a' ? { ...p, status: 'eliminated' as const } : p)), clues: game.clues.map((c) => (c.hunterId === 'a' ? { ...c, status: 'cancelled' as const } : c)) },
      [],
    );
    gate2.resolve(evidence(true));
    await waitUntil(async () => expect((await e.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('judge_busy'));
    game = (await e.games.loadByCode('ABCDE'))!;
    expect(game.clues[0]!.judgement!.result!.message).toContain('ended');
    expect(game.players[0]!.failedAttempts).toBe(0);
  });

  test('a verdict that lands after time ran out ends busy without charging an attempt', async () => {
    const gate = deferred<MatchEvidence>();
    const s = await setup({ compare: () => gate.promise, judgeBudgetMs: 20 });
    await s.submit('a', 'ca');
    s.setNow(T0.getTime() + 60_000 + 600_000);
    gate.resolve(evidence(true));
    await waitUntil(async () => expect((await s.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result?.outcome).toBe('judge_busy'));
    const game = (await s.games.loadByCode('ABCDE'))!;
    expect(game.status).toBe('finished');
    expect(game.clues[0]!.judgement!.result!.message).toContain('ended');
    expect(game.players[0]!.failedAttempts).toBe(0);
  });

  test('a lost judge is expired by the clock, its submission closed and the clue freed', async () => {
    const gate = deferred<MatchEvidence>();
    const s = await setup({ compare: () => gate.promise, judgeBudgetMs: 20, judgeHardBudgetMs: 10_000 });
    const res = await s.submit('a', 'ca');
    expect(res.pending).toBe(true);
    s.setNow(T0.getTime() + 60_000 + 10_000 + 5000 + 1);
    const game = await tick(s.deps, 'ABCDE');
    expect(game.clues[0]!.judgement!.result).toMatchObject({ outcome: 'judge_busy', pending: false });
    expect(game.clues[0]!.judgement!.result!.message).toContain('try again');
    expect(s.submissions.all).toMatchObject([{ outcome: 'judge_busy', points: null }]);
    s.compare.mockImplementation(async () => evidence(true));
    expect(await s.submit('a', 'ca')).toMatchObject({ outcome: 'match', pending: false });
    gate.resolve(evidence(false));
    await new Promise((r) => setTimeout(r, 20));
    const after = (await s.games.loadByCode('ABCDE'))!;
    expect(after.clues[0]!.judgement!.result!.outcome).toBe('match');
    expect(s.submissions.all.filter((r2) => r2.outcome === 'match')).toHaveLength(1);
    expect(s.submissions.all.filter((r2) => r2.outcome !== 'match')).toHaveLength(1);
  });

  test('a judge that fails outright still returns a busy result at no attempt cost', async () => {
    const failing = await setup({ compare: async () => Promise.reject(new Error('500')) });
    const res = await failing.submit('a', 'ca');
    expect(res).toMatchObject({ outcome: 'judge_busy', attemptsLeft: 5 });
    await waitUntil(async () => expect((await failing.games.loadByCode('ABCDE'))!.clues[0]!.judgement?.result).toMatchObject({ outcome: 'judge_busy', pending: false }));
    expect((await failing.games.loadByCode('ABCDE'))!.players[0]!.failedAttempts).toBe(0);
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

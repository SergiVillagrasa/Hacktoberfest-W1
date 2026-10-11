import { describe, expect, test } from 'vitest';
import { COUNTDOWN_MS, createMemoryGameRepository, createRoom, joinRoom, seededRng, startRoom, tick, type GameError, type RoomDeps, type Target } from '../src';

const T0 = new Date('2026-10-11T10:00:00Z');

async function setup(opts: { acceptTargets?: boolean; players?: number } = {}) {
  let n = 0;
  let clock = T0;
  const games = createMemoryGameRepository();
  const deps: RoomDeps & { setNow: (d: Date) => void } = {
    games, now: () => clock, rng: seededRng(4), newId: () => `id${++n}`, newToken: () => `t${++n}`, hashToken: (t) => t, setNow: (d) => void (clock = d),
  };
  const ann = await createRoom(deps, { nickname: 'Ann', timeLimitMinutes: 10 });
  const sessions = [ann];
  for (let i = 1; i < (opts.players ?? 2); i++) sessions.push(await joinRoom(deps, { code: ann.roomCode, nickname: `P${i}` }));
  const game = (await games.loadByCode(ann.roomCode))!;
  const assets = { prep: 'ready' as const, clues: { first: 'a', second: 'b', visual: 'c', judgeBusy: 'd' }, audio: { first: null, second: null, visual: null, judgeBusy: null }, hintPath: null };
  const targets: Target[] = sessions.map((s, i) => ({ id: `t-${i}`, ownerId: s.playerId, imagePath: `p${i}.jpg`, validation: opts.acceptTargets === false ? 'pending' : 'accepted', rejectReason: null, foundBy: null, foundAt: null, points: null, assets }));
  await games.save({ ...game, targets }, []);
  return { deps, games, code: ann.roomCode, sessions };
}
const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e: GameError) => e))?.code ?? null);

describe('startRoom', () => {
  test('the creator starts the countdown and voice clues are assigned', async () => {
    const { deps, games, code: c, sessions } = await setup();
    const before = (await games.version(c))!;
    const game = await startRoom(deps, { code: c, actorId: sessions[0]!.playerId });
    expect(game).toMatchObject({ status: 'countdown', version: before + 1 });
    expect(game.countdownEndsAt!.getTime()).toBe(T0.getTime() + COUNTDOWN_MS);
    expect(game.clues).toHaveLength(2);
    expect((await games.loadByCode(c))!.status).toBe('countdown');
  });

  test('non-creators get forbidden, pending targets not_ready, a lone player invalid_state', async () => {
    const ready = await setup();
    expect(await code(startRoom(ready.deps, { code: ready.code, actorId: ready.sessions[1]!.playerId }))).toBe('forbidden');
    const pending = await setup({ acceptTargets: false });
    expect(await code(startRoom(pending.deps, { code: pending.code, actorId: pending.sessions[0]!.playerId }))).toBe('not_ready');
    const solo = await setup({ players: 1 });
    expect(await code(startRoom(solo.deps, { code: solo.code, actorId: solo.sessions[0]!.playerId }))).toBe('invalid_state');
  });
});

describe('startRoom clue readiness', () => {
  test('waits until every accepted target has its clue texts, so later failures cannot revoke a target', async () => {
    const { deps, games, code: c, sessions } = await setup();
    const game = (await games.loadByCode(c))!;
    await games.save({ ...game, targets: game.targets.map((t, i) => (i === 0 ? { ...t, assets: { ...t.assets, prep: 'pending' as const, clues: null } } : t)) }, []);
    expect(await code(startRoom(deps, { code: c, actorId: sessions[0]!.playerId }))).toBe('not_ready');
    const again = (await games.loadByCode(c))!;
    await games.save({ ...again, targets: again.targets.map((t) => ({ ...t, assets: { ...t.assets, clues: { first: 'a', second: 'b', visual: 'c', judgeBusy: 'd' } } })) }, []);
    expect((await startRoom(deps, { code: c, actorId: sessions[0]!.playerId })).status).toBe('countdown');
  });
});

describe('tick', () => {
  test('moves countdown to active to finished from the clock alone, saving once per change', async () => {
    const { deps, games, code: c, sessions } = await setup();
    await startRoom(deps, { code: c, actorId: sessions[0]!.playerId });
    deps.setNow(new Date(T0.getTime() + COUNTDOWN_MS - 1));
    expect((await tick(deps, c)).status).toBe('countdown');
    deps.setNow(new Date(T0.getTime() + COUNTDOWN_MS));
    expect((await tick(deps, c)).status).toBe('active');
    const version = await games.version(c);
    await tick(deps, c);
    expect(await games.version(c)).toBe(version);
    deps.setNow(new Date(T0.getTime() + COUNTDOWN_MS + 600_000));
    const done = await tick(deps, c);
    expect(done.status).toBe('finished');
    expect(games.events.map((e) => e.type)).toEqual(['game_started', 'game_finished']);
  });

  test('concurrent ticks both resolve to the same state and emit each event once', async () => {
    const { deps, games, code: c, sessions } = await setup();
    await startRoom(deps, { code: c, actorId: sessions[0]!.playerId });
    deps.setNow(new Date(T0.getTime() + COUNTDOWN_MS + 600_000));
    const [a, b] = await Promise.all([tick(deps, c), tick(deps, c)]);
    expect([a.status, b.status]).toEqual(['finished', 'finished']);
    expect(games.events.map((e) => e.type)).toEqual(['game_started', 'game_finished']);
  });

  test('unknown rooms are not_found', async () => {
    const { deps } = await setup();
    expect(await code(tick(deps, 'ZZZZZ'))).toBe('not_found');
  });
});

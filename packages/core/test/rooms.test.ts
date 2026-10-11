import { describe, expect, test } from 'vitest';
import { createMemoryGameRepository, createRoom, joinRoom, removePlayer, seededRng, type GameError, type RoomDeps } from '../src';

function setup() {
  let n = 0;
  const games = createMemoryGameRepository();
  const deps: RoomDeps = {
    games,
    now: () => new Date('2026-10-11T10:00:00Z'),
    rng: seededRng(5),
    newId: () => `id${++n}`,
    newToken: () => `tok${++n}`,
    hashToken: (t) => `hash:${t}`,
  };
  return { games, deps };
}
const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e: GameError) => e))?.code ?? null);

describe('rooms', () => {
  test('createRoom makes a lobby with the creator and a hashed token', async () => {
    const { games, deps } = setup();
    const s = await createRoom(deps, { nickname: 'Ann', timeLimitMinutes: 15 });
    const game = (await games.loadByCode(s.roomCode))!;
    expect(game).toMatchObject({ status: 'lobby', timeLimitMs: 900_000, version: 0 });
    expect(game.players).toMatchObject([{ id: s.playerId, nickname: 'Ann', isCreator: true }]);
    expect(await games.findPlayerByTokenHash(`hash:${s.token}`)).toEqual({ roomCode: s.roomCode, playerId: s.playerId });
  });

  test('createRoom retries when the generated code is already taken', async () => {
    const { games, deps } = setup();
    const first = await createRoom(deps, { nickname: 'Ann', timeLimitMinutes: 10 });
    const second = await createRoom({ ...deps, rng: seededRng(5) }, { nickname: 'Bob', timeLimitMinutes: 10 });
    expect(second.roomCode).not.toBe(first.roomCode);
    expect((await games.loadByCode(first.roomCode))!.players[0]!.nickname).toBe('Ann');
    expect((await games.loadByCode(second.roomCode))!.players[0]!.nickname).toBe('Bob');
  });

  test('in-memory recentEvents only returns the requested room', async () => {
    const { games, deps } = setup();
    const a = await createRoom(deps, { nickname: 'Ann', timeLimitMinutes: 10 });
    const b = await createRoom(deps, { nickname: 'Bob', timeLimitMinutes: 10 });
    const [ga, gb] = [(await games.loadByCode(a.roomCode))!, (await games.loadByCode(b.roomCode))!];
    const at = new Date();
    await games.save(ga, [{ type: 'solo_mode', at }]);
    await games.save(gb, [{ type: 'game_started', at }]);
    expect(await games.recentEvents(ga.roomId, 10)).toMatchObject([{ type: 'solo_mode' }]);
    expect(await games.recentEvents(gb.roomId, 10)).toMatchObject([{ type: 'game_started' }]);
  });

  test('createRoom rejects an unsupported time limit', async () => {
    expect(await code(createRoom(setup().deps, { nickname: 'Ann', timeLimitMinutes: 12 }))).toBe('invalid_state');
  });

  test('joinRoom fills the room up to 6 players then reports room_full', async () => {
    const { deps } = setup();
    const { roomCode } = await createRoom(deps, { nickname: 'P0', timeLimitMinutes: 10 });
    for (let i = 1; i < 6; i++) await joinRoom(deps, { code: roomCode, nickname: `P${i}` });
    expect(await code(joinRoom(deps, { code: roomCode, nickname: 'P6' }))).toBe('room_full');
    expect(await code(joinRoom(deps, { code: 'ZZZZZ', nickname: 'X' }))).toBe('not_found');
  });

  test('joinRoom after the game started is invalid_state', async () => {
    const { games, deps } = setup();
    const { roomCode } = await createRoom(deps, { nickname: 'Ann', timeLimitMinutes: 10 });
    const game = (await games.loadByCode(roomCode))!;
    await games.save({ ...game, status: 'countdown' }, []);
    expect(await code(joinRoom(deps, { code: roomCode, nickname: 'Bob' }))).toBe('invalid_state');
  });

  test('removePlayer: only the creator, not self, lobby only; removes the player and their token', async () => {
    const { games, deps } = setup();
    const ann = await createRoom(deps, { nickname: 'Ann', timeLimitMinutes: 10 });
    const bob = await joinRoom(deps, { code: ann.roomCode, nickname: 'Bob' });
    expect(await code(removePlayer(deps, { code: ann.roomCode, actorId: bob.playerId, playerId: ann.playerId }))).toBe('forbidden');
    expect(await code(removePlayer(deps, { code: ann.roomCode, actorId: ann.playerId, playerId: ann.playerId }))).toBe('forbidden');
    expect(await code(removePlayer(deps, { code: ann.roomCode, actorId: ann.playerId, playerId: 'nope' }))).toBe('not_found');
    await removePlayer(deps, { code: ann.roomCode, actorId: ann.playerId, playerId: bob.playerId });
    expect((await games.loadByCode(ann.roomCode))!.players).toHaveLength(1);
    expect(await games.findPlayerByTokenHash(`hash:${bob.token}`)).toBeNull();
  });
});

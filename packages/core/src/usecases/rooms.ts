import { MAX_PLAYERS, TIME_LIMIT_MINUTES } from '../domain/constants';
import { GameError } from '../domain/errors';
import { generateRoomCode } from '../domain/room-code';
import type { Game, IdGen, Player, Rng } from '../domain/types';
import type { GameRepository } from '../ports';

export interface RoomDeps {
  games: GameRepository;
  now: () => Date;
  rng: Rng;
  newId: IdGen;
  newToken: () => string;
  hashToken: (token: string) => string;
}

export interface Session {
  roomCode: string;
  playerId: string;
  token: string;
}

const MAX_CONFLICT_RETRIES = 3;
const MAX_CODE_ATTEMPTS = 10;

export async function updateGame<T>(games: GameRepository, code: string, change: (game: Game) => Promise<T> | T, save: (game: Game, result: T) => Promise<Game>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const game = await games.loadByCode(code);
    if (!game) throw new GameError('not_found', 'Room not found');
    const result = await change(game);
    try {
      await save(game, result);
      return result;
    } catch (e) {
      if (!(e instanceof GameError) || e.code !== 'version_conflict' || attempt >= MAX_CONFLICT_RETRIES) throw e;
    }
  }
}

const newPlayer = (deps: RoomDeps, nickname: string, isCreator: boolean): Player => ({
  id: deps.newId(),
  nickname,
  isCreator,
  status: 'active',
  failedAttempts: 0,
  joinedAt: deps.now(),
});

export async function createRoom(deps: RoomDeps, input: { nickname: string; timeLimitMinutes: number }): Promise<Session> {
  if (!(TIME_LIMIT_MINUTES as readonly number[]).includes(input.timeLimitMinutes)) throw new GameError('invalid_state', 'Unsupported time limit');
  const creator = newPlayer(deps, input.nickname, true);
  const token = deps.newToken();
  const roomId = deps.newId();
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode(deps.rng);
    const game: Game = newLobby(roomId, code, input.timeLimitMinutes, creator);
    if (await deps.games.create(game, { [creator.id]: deps.hashToken(token) })) return { roomCode: code, playerId: creator.id, token };
  }
  throw new GameError('invalid_state', 'Could not allocate a room code');
}

function newLobby(roomId: string, code: string, timeLimitMinutes: number, creator: Player): Game {
  return {
    roomId,
    code,
    status: 'lobby',
    phase: 'races',
    timeLimitMs: timeLimitMinutes * 60_000,
    countdownEndsAt: null,
    endsAt: null,
    finishedAt: null,
    players: [creator],
    targets: [],
    clues: [],
    version: 0,
  };
}

export async function joinRoom(deps: RoomDeps, input: { code: string; nickname: string }): Promise<Session> {
  const token = deps.newToken();
  let playerId = '';
  await updateGame(
    deps.games,
    input.code,
    (game) => {
      if (game.status !== 'lobby') throw new GameError('invalid_state', 'The game already started');
      if (game.players.length >= MAX_PLAYERS) throw new GameError('room_full', 'This room is full');
      const player = newPlayer(deps, input.nickname, false);
      playerId = player.id;
      return { ...game, players: [...game.players, player] };
    },
    (game, next) => deps.games.save(next, [], { [playerId]: deps.hashToken(token) }),
  );
  return { roomCode: input.code, playerId, token };
}

export async function removePlayer(deps: RoomDeps, input: { code: string; actorId: string; playerId: string }): Promise<void> {
  await updateGame(
    deps.games,
    input.code,
    (game) => {
      if (game.players.find((p) => p.id === input.actorId)?.isCreator !== true) throw new GameError('forbidden', 'Only the creator can remove players');
      if (game.status !== 'lobby') throw new GameError('invalid_state', 'The game already started');
      if (input.playerId === input.actorId) throw new GameError('forbidden', 'You cannot remove yourself');
      if (!game.players.some((p) => p.id === input.playerId)) throw new GameError('not_found', 'Player not found');
      return {
        ...game,
        players: game.players.filter((p) => p.id !== input.playerId),
        targets: game.targets.filter((t) => t.ownerId !== input.playerId),
      };
    },
    (game, next) => deps.games.save(next, []),
  );
}

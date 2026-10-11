import { advanceClock, startGame } from '../domain/game';
import { GameError } from '../domain/errors';
import type { Game, IdGen, Rng } from '../domain/types';
import type { GameRepository } from '../ports';
import { updateGame } from './rooms';

export interface ClockDeps {
  games: GameRepository;
  now: () => Date;
}

export interface StartDeps extends ClockDeps {
  rng: Rng;
  newId: IdGen;
}

const MAX_TICK_ATTEMPTS = 3;

export async function startRoom(deps: StartDeps, input: { code: string; actorId: string }): Promise<Game> {
  let started!: Game;
  await updateGame(
    deps.games,
    input.code,
    (game) => {
      if (game.players.find((p) => p.id === input.actorId)?.isCreator !== true) throw new GameError('forbidden', 'Only the creator can start the game');
      if (game.targets.some((t) => t.validation === 'accepted' && !t.assets.clues)) throw new GameError('not_ready', 'Still writing the clues, one moment');
      return startGame(game, deps.now(), deps.rng, deps.newId);
    },
    async (_game, transition) => (started = await deps.games.save(transition.game, transition.events)),
  );
  return started;
}

export async function tick(deps: ClockDeps, code: string): Promise<Game> {
  for (let attempt = 0; ; attempt++) {
    const game = await deps.games.loadByCode(code);
    if (!game) throw new GameError('not_found', 'Room not found');
    const { game: next, events } = advanceClock(game, deps.now());
    if (next === game) return game;
    try {
      return await deps.games.save(next, events);
    } catch (e) {
      if (!(e instanceof GameError) || e.code !== 'version_conflict' || attempt >= MAX_TICK_ATTEMPTS) throw e;
    }
  }
}

import { useSecondClue } from '../domain/game';
import type { Game } from '../domain/types';
import type { GameRepository } from '../ports';
import { mutateGame } from './rooms';

export async function requestSecondClue(deps: { games: GameRepository }, input: { code: string; playerId: string; clueId: string }): Promise<Game> {
  return mutateGame(deps.games, input.code, (game) => useSecondClue(game, input.clueId, input.playerId));
}

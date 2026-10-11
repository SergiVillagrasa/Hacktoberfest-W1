import { COUNTDOWN_MS, MAX_PLAYERS, MIN_PLAYERS } from './constants';
import { createDerangement } from './derangement';
import { GameError } from './errors';
import type { Clue, DomainEvent, Game, IdGen, Rng, Transition } from './types';

export function startGame(game: Game, now: Date, rng: Rng, newId: IdGen): Transition {
  if (game.status !== 'lobby') throw new GameError('invalid_state', 'Game already started');
  if (game.players.length < MIN_PLAYERS || game.players.length > MAX_PLAYERS)
    throw new GameError('invalid_state', `Games need ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  const owned = game.players.map((p) => game.targets.filter((t) => t.ownerId === p.id && t.validation === 'accepted'));
  if (owned.some((targets) => targets.length !== 1)) throw new GameError('not_ready', 'Every player needs an accepted target');

  const countdownEndsAt = new Date(now.getTime() + COUNTDOWN_MS);
  const hunts = createDerangement(game.players.map((p) => p.id), rng);
  const clues: Clue[] = [...hunts].map(([hunterId, ownerId]) => ({
    id: newId(),
    targetId: game.targets.find((t) => t.ownerId === ownerId && t.validation === 'accepted')!.id,
    hunterId,
    kind: 'voice',
    issuedAt: countdownEndsAt,
    secondClueUsed: false,
    judgeBusyServed: false,
    status: 'active',
  }));
  return {
    game: {
      ...game,
      status: 'countdown',
      countdownEndsAt,
      endsAt: new Date(countdownEndsAt.getTime() + game.timeLimitMs),
      clues,
    },
    events: [],
  };
}

export function advanceClock(game: Game, now: Date): Transition {
  let next = game;
  const events: DomainEvent[] = [];
  if (next.status === 'countdown' && next.countdownEndsAt && now >= next.countdownEndsAt) {
    next = { ...next, status: 'active' };
    events.push({ type: 'game_started', at: next.countdownEndsAt! });
  }
  if (next.status === 'active' && next.endsAt && now >= next.endsAt) {
    next = { ...next, status: 'finished', finishedAt: next.endsAt };
    events.push({ type: 'game_finished', at: next.endsAt!, reason: 'time_up' });
  }
  return { game: next, events };
}

export function useSecondClue(game: Game, clueId: string, playerId: string): Game {
  const clue = game.clues.find((c) => c.id === clueId);
  if (!clue) throw new GameError('not_found', 'Clue not found');
  if (clue.hunterId !== playerId) throw new GameError('forbidden', 'Not your clue');
  if (game.status !== 'active' || clue.kind !== 'voice' || clue.status !== 'active')
    throw new GameError('clue_not_active', 'No second clue available');
  if (clue.secondClueUsed) throw new GameError('second_clue_used', 'Second clue already used');
  return { ...game, clues: game.clues.map((c) => (c.id === clueId ? { ...c, secondClueUsed: true } : c)) };
}

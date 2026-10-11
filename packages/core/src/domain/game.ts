import { COUNTDOWN_MS, MAX_FAILED_ATTEMPTS, MAX_PLAYERS, MIN_PLAYERS } from './constants';
import { createDerangement } from './derangement';
import { GameError } from './errors';
import { eligibleVisualTargets, shouldEnterSolo } from './races';
import { scoreFind } from './scoring';
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

const patch = <T extends { id: string }>(items: T[], id: string, change: Partial<T>): T[] =>
  items.map((i) => (i.id === id ? { ...i, ...change } : i));

export function checkEnd(game: Game, at: Date): Transition {
  if (game.status !== 'active') return { game, events: [] };
  const open = game.targets.filter((t) => t.foundBy === null);
  const pursued = game.clues.some(
    (c) =>
      c.status === 'active' &&
      game.players.find((p) => p.id === c.hunterId)?.status === 'active' &&
      open.some((t) => t.id === c.targetId),
  );
  const reason = open.length === 0 ? 'all_found' : pursued ? null : 'no_pursuers';
  if (!reason) return { game, events: [] };
  return { game: { ...game, status: 'finished', finishedAt: at }, events: [{ type: 'game_finished', at, reason }] };
}

function settle(game: Game, at: Date, events: DomainEvent[]): Transition {
  let next = game;
  if (shouldEnterSolo(next)) {
    next = { ...next, phase: 'solo' };
    events.push({ type: 'solo_mode', at });
  }
  const end = checkEnd(next, at);
  return { game: end.game, events: [...events, ...end.events] };
}

export function applyVerifiedFind(game: Game, clueId: string, foundAt: Date, rng: Rng, newId: IdGen): Transition {
  const clue = game.clues.find((c) => c.id === clueId);
  if (!clue) throw new GameError('not_found', 'Clue not found');
  const target = game.targets.find((t) => t.id === clue.targetId)!;
  if (target.foundBy !== null) throw new GameError('already_found', 'Target already found');
  if (game.status !== 'active' || clue.status !== 'active') throw new GameError('clue_not_active', 'Clue is not active');
  if (game.players.find((p) => p.id === clue.hunterId)?.status !== 'active')
    throw new GameError('not_active_player', 'Player is no longer in the game');

  const points = scoreFind({ issuedAt: clue.issuedAt, foundAt, timeLimitMs: game.timeLimitMs, secondClueUsed: clue.secondClueUsed });
  const events: DomainEvent[] = [{ type: 'target_found', at: foundAt, targetId: target.id, hunterId: clue.hunterId, points, kind: clue.kind }];
  const eliminated = new Set<string>();
  let clues = game.clues.map((c) => {
    if (c.id === clue.id) return { ...c, status: 'won' as const };
    if (c.status !== 'active' || c.targetId !== target.id) return c;
    if (clue.kind === 'visual' && c.kind === 'voice') {
      eliminated.add(c.hunterId);
      events.push({ type: 'player_eliminated', at: foundAt, playerId: c.hunterId, byPlayerId: clue.hunterId });
    }
    return { ...c, status: 'lost' as const };
  });
  clues = clues.map((c) => (c.status === 'active' && eliminated.has(c.hunterId) ? { ...c, status: 'cancelled' as const } : c));

  let next: Game = {
    ...game,
    clues,
    players: game.players.map((p) => (eliminated.has(p.id) ? { ...p, status: 'eliminated' as const } : p)),
    targets: patch(game.targets, target.id, { foundBy: clue.hunterId, foundAt, points }),
  };
  if (next.phase === 'races') {
    const options = eligibleVisualTargets(next, clue.hunterId);
    const pick = options[Math.floor(rng() * options.length)];
    if (pick) {
      const visual: Clue = { id: newId(), targetId: pick.id, hunterId: clue.hunterId, kind: 'visual', issuedAt: foundAt, secondClueUsed: false, judgeBusyServed: false, status: 'active' };
      next = { ...next, clues: [...next.clues, visual] };
      events.push({ type: 'visual_clue_issued', at: foundAt, clueId: visual.id, hunterId: visual.hunterId, targetId: visual.targetId });
    }
  }
  return settle(next, foundAt, events);
}

export function applyFailedAttempt(game: Game, playerId: string, at: Date): Transition {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new GameError('not_found', 'Player not found');
  if (game.status !== 'active') throw new GameError('invalid_state', 'Game is not active');
  if (player.status !== 'active') throw new GameError('not_active_player', 'Player is no longer in the game');
  const failedAttempts = player.failedAttempts + 1;
  const out = failedAttempts >= MAX_FAILED_ATTEMPTS;
  const events: DomainEvent[] = out ? [{ type: 'player_out_of_attempts', at, playerId }] : [];
  const next: Game = {
    ...game,
    players: patch(game.players, playerId, { failedAttempts, ...(out ? { status: 'out_of_attempts' as const } : {}) }),
    clues: out ? game.clues.map((c) => (c.hunterId === playerId && c.status === 'active' ? { ...c, status: 'cancelled' as const } : c)) : game.clues,
  };
  return settle(next, at, events);
}

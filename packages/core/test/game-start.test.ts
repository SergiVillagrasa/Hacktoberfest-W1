import { describe, expect, test } from 'vitest';
import { GameError, advanceClock, seededRng, startGame, useSecondClue } from '../src';
import { makeClue, makeGame, makePlayer, makeTarget, T0 } from './fixtures';

const counter = () => {
  let n = 0;
  return () => `id${++n}`;
};
const lobby = (n: number, overrides: Parameters<typeof makeGame>[0] = {}) => {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  return makeGame({
    status: 'lobby',
    countdownEndsAt: null,
    endsAt: null,
    players: ids.map((id) => makePlayer(id)),
    targets: ids.map((id) => makeTarget(`t-${id}`, id)),
    ...overrides,
  });
};
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as GameError).code;
  }
};

describe('startGame', () => {
  test('creates voice clues, nobody hunts their own, sets timers', () => {
    const { game } = startGame(lobby(3), T0, seededRng(1), counter());
    expect(game.status).toBe('countdown');
    expect(game.clues).toHaveLength(3);
    for (const c of game.clues) {
      expect(game.targets.find((t) => t.id === c.targetId)!.ownerId).not.toBe(c.hunterId);
      expect(c.issuedAt).toEqual(game.countdownEndsAt);
    }
    expect(game.countdownEndsAt!.getTime()).toBe(T0.getTime() + 5000);
    expect(game.endsAt!.getTime()).toBe(T0.getTime() + 5000 + game.timeLimitMs);
  });

  test('rejects pending targets and too few players', () => {
    const pending = lobby(3);
    pending.targets[0]!.validation = 'pending';
    expect(code(() => startGame(pending, T0, seededRng(1), counter()))).toBe('not_ready');
    expect(code(() => startGame(lobby(1), T0, seededRng(1), counter()))).toBe('invalid_state');
  });
});

describe('advanceClock', () => {
  const started = () => startGame(lobby(3), T0, seededRng(1), counter()).game;

  test('moves countdown to active then finished', () => {
    const g = started();
    expect(advanceClock(g, new Date(T0.getTime() + 4999)).game.status).toBe('countdown');
    const active = advanceClock(g, g.countdownEndsAt!);
    expect(active.game.status).toBe('active');
    expect(active.events.map((e) => e.type)).toEqual(['game_started']);
    const done = advanceClock(active.game, g.endsAt!);
    expect(done.game.status).toBe('finished');
    expect(done.events).toMatchObject([{ type: 'game_finished', reason: 'time_up' }]);
  });

  test('jumps straight to finished if every phone was closed and is idempotent', () => {
    const g = started();
    const late = advanceClock(g, new Date(g.endsAt!.getTime() + 60_000));
    expect(late.game.status).toBe('finished');
    expect(late.events.map((e) => e.type)).toEqual(['game_started', 'game_finished']);
    expect(advanceClock(late.game, new Date(g.endsAt!.getTime() + 90_000)).events).toEqual([]);
  });
});

describe('useSecondClue', () => {
  const game = makeGame({
    players: [makePlayer('a'), makePlayer('b')],
    targets: [makeTarget('tb', 'b')],
    clues: [makeClue('c1', 'tb', 'a'), makeClue('v1', 'tb', 'a', { kind: 'visual' })],
  });

  test('marks the second clue once', () => {
    const next = useSecondClue(game, 'c1', 'a');
    expect(next.clues[0]!.secondClueUsed).toBe(true);
    expect(game.clues[0]!.secondClueUsed).toBe(false);
    expect(code(() => useSecondClue(next, 'c1', 'a'))).toBe('second_clue_used');
  });

  test('rejects visual clues and other players', () => {
    expect(code(() => useSecondClue(game, 'v1', 'a'))).toBe('clue_not_active');
    expect(code(() => useSecondClue(game, 'c1', 'b'))).toBe('forbidden');
  });
});

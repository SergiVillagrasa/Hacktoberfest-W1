import { describe, expect, test } from 'vitest';
import { GameError, applyFailedAttempt, applyVerifiedFind, seededRng, type Game } from '../src';
import { makeClue, makeGame, makePlayer, makeTarget, T0 } from './fixtures';

const at = (s: number) => new Date(T0.getTime() + s * 1000);
const counter = () => {
  let n = 0;
  return () => `n${++n}`;
};
const find = (g: Game, clueId: string, s = 60) => applyVerifiedFind(g, clueId, at(s), seededRng(7), counter());
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as GameError).code;
  }
};
const players = (n: number) => 'abcd'.slice(0, n).split('').map((id) => makePlayer(id));
const targets = (n: number) => 'abcd'.slice(0, n).split('').map((id) => makeTarget(`t${id}`, id));
const activeVisual = (g: Game) => g.clues.filter((c) => c.kind === 'visual' && c.status === 'active');

const ring3 = () =>
  makeGame({
    players: players(3),
    targets: targets(3),
    clues: [makeClue('ca', 'tb', 'a'), makeClue('cb', 'tc', 'b'), makeClue('cc', 'ta', 'c')],
  });

describe('applyVerifiedFind', () => {
  test('scores a voice find and gives the finder a visual clue', () => {
    const { game, events } = find(ring3(), 'ca');
    expect(game.targets[1]).toMatchObject({ foundBy: 'a', points: 900 });
    expect(game.clues[0]!.status).toBe('won');
    expect(activeVisual(game)).toMatchObject([{ hunterId: 'a', targetId: 'tc' }]);
    expect(events.map((e) => e.type)).toEqual(['target_found', 'visual_clue_issued']);
  });

  test('voice find with a visual challenger: challenger loses, nobody eliminated', () => {
    const g = ring3();
    g.clues.push(makeClue('v1', 'tb', 'c', { kind: 'visual' }));
    const { game } = find(g, 'ca');
    expect(game.clues.find((c) => c.id === 'v1')!.status).toBe('lost');
    expect(game.players.every((p) => p.status === 'active')).toBe(true);
  });

  test('visual find eliminates the voice hunter and cancels their other clues', () => {
    const g = makeGame({
      players: players(4),
      targets: targets(4),
      clues: [
        makeClue('ca', 'tb', 'a'), makeClue('cb', 'tc', 'b'), makeClue('cc', 'td', 'c'), makeClue('cd', 'ta', 'd'),
        makeClue('vc', 'tb', 'c', { kind: 'visual' }),
        makeClue('va', 'td', 'a', { kind: 'visual' }),
      ],
    });
    const { game, events } = find(g, 'vc');
    expect(game.players[0]!.status).toBe('eliminated');
    expect(game.clues.find((c) => c.id === 'ca')!.status).toBe('lost');
    expect(game.clues.find((c) => c.id === 'va')!.status).toBe('cancelled');
    expect(game.targets[1]!.foundBy).toBe('c');
    expect(events).toContainEqual({ type: 'player_eliminated', at: at(60), playerId: 'a', byPlayerId: 'c' });
  });

  test('never leaves two active visual clues for chained finds', () => {
    const first = find(ring3(), 'ca').game;
    const second = find(first, 'cc', 90).game;
    expect(activeVisual(first)).toHaveLength(1);
    expect(activeVisual(second).length).toBeLessThanOrEqual(1);
  });

  test('already found target is rejected and leaves the game untouched', () => {
    const { game } = find(ring3(), 'ca');
    const snapshot = structuredClone(game);
    expect(code(() => find(game, 'ca'))).toBe('already_found');
    expect(game).toEqual(snapshot);
  });

  test('finishes with all_found on the last target', () => {
    const two = makeGame({
      players: players(2),
      targets: targets(2),
      clues: [makeClue('ca', 'tb', 'a'), makeClue('cb', 'ta', 'b')],
    });
    const mid = find(two, 'ca');
    expect(mid.game.phase).toBe('solo');
    expect(mid.events.map((e) => e.type)).toContain('solo_mode');
    const end = find(mid.game, 'cb', 120);
    expect(end.game.status).toBe('finished');
    expect(end.events.at(-1)).toMatchObject({ type: 'game_finished', reason: 'all_found' });
  });

  test('final find in races phase finishes without entering solo', () => {
    const g = makeGame({
      players: players(2),
      targets: [makeTarget('ta', 'a', { foundBy: 'b', foundAt: at(30), points: 500 }), makeTarget('tb', 'b')],
      clues: [makeClue('ca', 'tb', 'a'), makeClue('cb', 'ta', 'b', { status: 'won' })],
    });
    const { game, events } = find(g, 'ca');
    expect(game.status).toBe('finished');
    expect(game.phase).toBe('races');
    expect(events.map((e) => e.type)).toEqual(['target_found', 'game_finished']);
  });

  test('solo phase issues no visual clues and eliminates nobody', () => {
    let g = ring3();
    for (const id of ['c', 'b']) for (let i = 0; i < 5; i++) g = applyFailedAttempt(g, id, at(10 + i)).game;
    expect(g.phase).toBe('solo');
    const { game, events } = find(g, 'ca');
    expect(game.clues.some((c) => c.kind === 'visual')).toBe(false);
    expect(events.some((e) => e.type === 'player_eliminated')).toBe(false);
  });
});

describe('applyFailedAttempt', () => {
  test('last pursuer running out in races phase finishes without entering solo', () => {
    const g = makeGame({
      players: [makePlayer('a', { status: 'out_of_attempts', failedAttempts: 5 }), makePlayer('b', { failedAttempts: 4 })],
      targets: targets(2),
      clues: [makeClue('ca', 'tb', 'a', { status: 'cancelled' }), makeClue('cb', 'ta', 'b')],
    });
    const { game, events } = applyFailedAttempt(g, 'b', at(5));
    expect(game.status).toBe('finished');
    expect(game.phase).toBe('races');
    expect(events.map((e) => e.type)).toEqual(['player_out_of_attempts', 'game_finished']);
  });

  test('fifth failure removes the player and cancels their clues; sixth is rejected', () => {
    let g = ring3();
    for (let i = 0; i < 4; i++) g = applyFailedAttempt(g, 'a', at(i)).game;
    expect(g.players[0]).toMatchObject({ status: 'active', failedAttempts: 4 });
    const last = applyFailedAttempt(g, 'a', at(5));
    expect(last.game.players[0]!.status).toBe('out_of_attempts');
    expect(last.game.clues[0]!.status).toBe('cancelled');
    expect(last.events[0]).toMatchObject({ type: 'player_out_of_attempts', playerId: 'a' });
    expect(code(() => applyFailedAttempt(last.game, 'a', at(6)))).toBe('not_active_player');
  });

  test('ends with no_pursuers when the last pursuer runs out', () => {
    let g = makeGame({
      players: players(2),
      targets: targets(2),
      clues: [makeClue('ca', 'tb', 'a'), makeClue('cb', 'ta', 'b')],
    });
    for (let i = 0; i < 5; i++) g = applyFailedAttempt(g, 'a', at(i)).game;
    expect(g.status).toBe('active');
    let last = { game: g, events: [] as unknown[] } as ReturnType<typeof applyFailedAttempt>;
    for (let i = 0; i < 5; i++) last = applyFailedAttempt(last.game, 'b', at(10 + i));
    expect(last.game.status).toBe('finished');
    expect(last.events.at(-1)).toMatchObject({ type: 'game_finished', reason: 'no_pursuers' });
  });
});

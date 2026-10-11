import { describe, expect, test } from 'vitest';
import { eligibleVisualTargets, isRacePossible, shouldEnterSolo } from '../src';
import { makeClue, makeGame, makePlayer, makeTarget, T0 } from './fixtures';

const ids = (ts: { id: string }[]) => ts.map((t) => t.id).sort();

function ring(extra: Parameters<typeof makeGame>[0] = {}) {
  const players = ['a', 'b', 'c', 'd'].map((id) => makePlayer(id));
  const targets = ['a', 'b', 'c', 'd'].map((id) => makeTarget(`t${id}`, id));
  const clues = [
    makeClue('ca', 'tb', 'a'),
    makeClue('cb', 'tc', 'b'),
    makeClue('cc', 'td', 'c'),
    makeClue('cd', 'ta', 'd'),
  ];
  return makeGame({ players, targets, clues, ...extra });
}

describe('eligibleVisualTargets', () => {
  test('excludes own target and found target after a voice find', () => {
    const game = ring();
    game.clues[0]!.status = 'won';
    game.targets[1]!.foundBy = 'a';
    expect(ids(eligibleVisualTargets(game, 'a'))).toEqual(['tc', 'td']);
  });

  test('empty while the hunter holds an active visual clue', () => {
    const game = ring();
    game.clues.push(makeClue('v1', 'tc', 'a', { kind: 'visual' }));
    expect(eligibleVisualTargets(game, 'a')).toEqual([]);
  });

  test('excludes targets with an active visual challenger', () => {
    const game = ring();
    game.clues.push(makeClue('v1', 'tc', 'a', { kind: 'visual' }));
    expect(ids(eligibleVisualTargets(game, 'b'))).not.toContain('tc');
  });

  test('orphaned targets become eligible for others', () => {
    const game = ring();
    game.players[3]!.status = 'out_of_attempts';
    game.clues[3]!.status = 'cancelled';
    expect(ids(eligibleVisualTargets(game, 'c'))).toContain('ta');
  });

  test('two players swapping leave no visual targets after a find', () => {
    const game = makeGame({
      players: [makePlayer('a'), makePlayer('b')],
      targets: [makeTarget('ta', 'a'), makeTarget('tb', 'b', { foundBy: 'a' })],
      clues: [makeClue('ca', 'tb', 'a', { status: 'won' }), makeClue('cb', 'ta', 'b')],
    });
    expect(eligibleVisualTargets(game, 'a')).toEqual([]);
    expect(shouldEnterSolo(game)).toBe(true);
  });
});

describe('isRacePossible / shouldEnterSolo', () => {
  test('three players all hunting can race', () => {
    const game = makeGame({
      players: ['a', 'b', 'c'].map((id) => makePlayer(id)),
      targets: ['a', 'b', 'c'].map((id) => makeTarget(`t${id}`, id)),
      clues: [makeClue('ca', 'tb', 'a'), makeClue('cb', 'tc', 'b'), makeClue('cc', 'ta', 'c')],
    });
    expect(isRacePossible(game)).toBe(true);
    expect(shouldEnterSolo(game)).toBe(false);
  });

  test('phase already solo never re-enters solo', () => {
    const game = makeGame({
      phase: 'solo',
      players: [makePlayer('a'), makePlayer('b')],
      targets: [makeTarget('ta', 'a'), makeTarget('tb', 'b')],
      clues: [makeClue('ca', 'tb', 'a', { issuedAt: T0 }), makeClue('cb', 'ta', 'b')],
    });
    expect(shouldEnterSolo(game)).toBe(false);
  });
});

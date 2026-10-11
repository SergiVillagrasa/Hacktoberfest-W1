import { describe, expect, test } from 'vitest';
import { rankPlayers } from '../src';
import { makeGame, makePlayer, makeTarget, T0 } from './fixtures';

const at = (m: number, s: number) => new Date(T0.getTime() + (m * 60 + s) * 1000);

describe('rankPlayers', () => {
  test('ties on score are broken by earliest last find', () => {
    const game = makeGame({
      players: [makePlayer('a'), makePlayer('b'), makePlayer('c')],
      targets: [
        makeTarget('t1', 'c', { foundBy: 'a', foundAt: at(5, 0), points: 900 }),
        makeTarget('t2', 'c', { foundBy: 'b', foundAt: at(3, 0), points: 900 }),
      ],
    });
    expect(rankPlayers(game).map((r) => [r.playerId, r.rank])).toEqual([['b', 1], ['a', 2], ['c', 3]]);
  });

  test('score sums points and counts finds', () => {
    const game = makeGame({
      players: [makePlayer('a'), makePlayer('b')],
      targets: [
        makeTarget('t1', 'b', { foundBy: 'a', foundAt: at(1, 0), points: 500 }),
        makeTarget('t2', 'b', { foundBy: 'a', foundAt: at(2, 0), points: 300 }),
      ],
    });
    const [first] = rankPlayers(game);
    expect(first).toMatchObject({ playerId: 'a', score: 800, finds: 2, lastFindAt: at(2, 0) });
  });

  test('zero-find players share the last rank, ordered by joinedAt', () => {
    const game = makeGame({
      players: [
        makePlayer('late', { joinedAt: at(0, 30) }),
        makePlayer('early', { joinedAt: at(0, 10) }),
        makePlayer('a'),
      ],
      targets: [makeTarget('t1', 'early', { foundBy: 'a', foundAt: at(1, 0), points: 100 })],
    });
    expect(rankPlayers(game).map((r) => [r.playerId, r.rank])).toEqual([['a', 1], ['early', 2], ['late', 2]]);
  });
});

import { expect, test } from 'vitest';
import { GameError, createDerangement, seededRng } from '../src';

test('derangement has no fixed points and is a permutation', () => {
  for (let n = 2; n <= 6; n++) {
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    for (let seed = 1; seed <= 1000; seed++) {
      const map = createDerangement(ids, seededRng(seed));
      expect([...map.keys()].sort()).toEqual([...ids].sort());
      expect([...map.values()].sort()).toEqual([...ids].sort());
      for (const id of ids) expect(map.get(id)).not.toBe(id);
    }
  }
});

test('derangement needs at least 2 ids', () => {
  for (const ids of [['a'], []]) {
    try {
      createDerangement(ids, seededRng(1));
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(GameError);
      expect((e as GameError).code).toBe('invalid_state');
    }
  }
});

test('both 3-player derangements occur', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 3000; seed++) seen.add(JSON.stringify([...createDerangement(['a', 'b', 'c'], seededRng(seed))]));
  expect(seen.size).toBe(2);
});

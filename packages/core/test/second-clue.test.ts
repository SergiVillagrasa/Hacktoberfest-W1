import { describe, expect, test } from 'vitest';
import { createMemoryGameRepository, requestSecondClue, type GameError } from '../src';
import { makeClue, makeGame, makePlayer, makeTarget } from './fixtures';

async function setup(status: 'active' | 'countdown' = 'active') {
  const games = createMemoryGameRepository();
  const game = makeGame({
    code: 'ABCDE',
    status,
    players: [makePlayer('a'), makePlayer('b')],
    targets: [makeTarget('tb', 'b')],
    clues: [makeClue('c1', 'tb', 'a'), makeClue('v1', 'tb', 'a', { kind: 'visual' })],
    version: 0,
  });
  await games.create(game, {});
  return games;
}
const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e: GameError) => e))?.code ?? null);

describe('requestSecondClue', () => {
  test('marks the second clue used and persists it once', async () => {
    const games = await setup();
    const game = await requestSecondClue({ games }, { code: 'ABCDE', playerId: 'a', clueId: 'c1' });
    expect(game.clues[0]!.secondClueUsed).toBe(true);
    expect((await games.loadByCode('ABCDE'))!.clues[0]!.secondClueUsed).toBe(true);
    expect(await code(requestSecondClue({ games }, { code: 'ABCDE', playerId: 'a', clueId: 'c1' }))).toBe('second_clue_used');
  });

  test('rejects visual clues, other players, unknown clues and rooms not in play', async () => {
    const games = await setup();
    expect(await code(requestSecondClue({ games }, { code: 'ABCDE', playerId: 'a', clueId: 'v1' }))).toBe('clue_not_active');
    expect(await code(requestSecondClue({ games }, { code: 'ABCDE', playerId: 'b', clueId: 'c1' }))).toBe('forbidden');
    expect(await code(requestSecondClue({ games }, { code: 'ABCDE', playerId: 'a', clueId: 'nope' }))).toBe('not_found');
    expect(await code(requestSecondClue({ games: await setup('countdown') }, { code: 'ABCDE', playerId: 'a', clueId: 'c1' }))).toBe('clue_not_active');
  });
});

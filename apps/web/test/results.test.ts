import type { RoomView } from '@snaphunt/contracts';
import { describe, expect, test } from 'vitest';
import { hasTieBreak, recapSummary, sortedPlayers, spectatorReason, winnerLine } from '../src/lib/results';

type Ranking = NonNullable<RoomView['ranking']>;
const entry = (playerId: string, score: number, rank: number, finds = 1) => ({ playerId, nickname: playerId.toUpperCase(), score, finds, lastFindAt: null, rank });

describe('results', () => {
  test('a tie-break note is shown only when equal scores were separated by timing', () => {
    expect(hasTieBreak([entry('a', 900, 1), entry('b', 900, 2), entry('c', 0, 3, 0)] as Ranking)).toBe(true);
    expect(hasTieBreak([entry('a', 900, 1), entry('b', 500, 2)] as Ranking)).toBe(false);
    expect(hasTieBreak([entry('a', 0, 1, 0), entry('b', 0, 1, 0)] as Ranking)).toBe(false);
  });

  test('the host announces the winner, celebrates with you if you won, and handles a game nobody scored in', () => {
    const ranking = [entry('a', 900, 1), entry('b', 500, 2)] as Ranking;
    expect(winnerLine(ranking, 'b')).toEqual({ state: 'trophy', line: 'A wins the hunt!' });
    expect(winnerLine(ranking, 'a')).toEqual({ state: 'celebrating', line: 'You won! What a hunt!' });
    expect(winnerLine([entry('a', 0, 1, 0)] as Ranking, 'a').line).toMatch(/Nobody found/);
    expect(winnerLine([], 'a').state).toBe('trophy');
  });

  test('recap summaries say who found it and for how many points', () => {
    expect(recapSummary({ finderNickname: 'Ann', points: 749 })).toBe('Found by Ann for 749 points');
    expect(recapSummary({ finderNickname: 'Ann', points: null })).toBe('Found by Ann');
    expect(recapSummary({ finderNickname: null, points: null })).toBe('Nobody found this one');
  });
});

describe('scoreboard and spectator', () => {
  const player = (id: string, score: number, finds: number) => ({ id, nickname: id, isCreator: false, status: 'active' as const, ready: true, score, finds });

  test('players are ordered by score, then finds, then name', () => {
    const order = sortedPlayers([player('c', 0, 0), player('b', 500, 1), player('a', 500, 2), player('d', 900, 1)]).map((p) => p.id);
    expect(order).toEqual(['d', 'a', 'b', 'c']);
  });

  test('the spectator banner explains why the player is out', () => {
    expect(spectatorReason('eliminated')).toMatchObject({ state: 'shocked', title: "You're out!" });
    expect(spectatorReason('out_of_attempts')).toMatchObject({ state: 'sad', title: "You're out of attempts" });
  });
});

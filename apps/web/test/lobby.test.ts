import { describe, expect, test } from 'vitest';
import { fitWithin } from '../src/components/camera/resize';
import { canStart, shareUrl, startHint } from '../src/lib/lobby';

const players = (...ready: boolean[]) => ({ players: ready.map((r, i) => ({ id: `p${i}`, nickname: `P${i}`, isCreator: i === 0, status: 'active' as const, ready: r, score: 0, finds: 0 })) });

describe('lobby rules', () => {
  test('start needs at least 2 players and everyone ready', () => {
    expect(canStart(players(true))).toBe(false);
    expect(canStart(players(true, false))).toBe(false);
    expect(canStart(players(true, true))).toBe(true);
    expect(canStart(players(true, true, false))).toBe(false);
  });

  test('the hint says what the host is waiting for', () => {
    expect(startHint(players(true))).toMatch(/friend/);
    expect(startHint(players(true, false))).toBe('Waiting for 1 player to be ready.');
    expect(startHint(players(false, false, true))).toBe('Waiting for 2 players to be ready.');
    expect(startHint(players(true, true))).toMatch(/ready/);
  });

  test('the invite link carries the room code', () => {
    expect(shareUrl('https://snaphunt.app', 'ABCDE')).toBe('https://snaphunt.app/join?code=ABCDE');
  });
});

describe('photo sizing', () => {
  test('large photos shrink so the longest side is at most 1280 and keep their ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: 1280 });
  });

  test('small photos are never enlarged and sizes stay at least one pixel', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(100000, 10)).toEqual({ width: 1280, height: 1 });
  });
});

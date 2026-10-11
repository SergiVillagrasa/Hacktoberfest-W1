import { describe, expect, test } from 'vitest';
import { scoreFind } from '../src';
import { T0 } from './fixtures';

const limit = 600_000;
const score = (elapsedS: number, secondClueUsed = false) =>
  scoreFind({ issuedAt: T0, foundAt: new Date(T0.getTime() + elapsedS * 1000), timeLimitMs: limit, secondClueUsed });

describe('scoreFind', () => {
  test('decreases with elapsed time', () => {
    expect(score(0)).toBe(1000);
    expect(score(60)).toBe(900);
    expect(score(570)).toBe(250);
  });
  test('second clue multiplies by 0.75', () => {
    expect(score(60, true)).toBe(675);
    expect(score(570, true)).toBe(188);
  });
  test('floors at 250 beyond the limit', () => {
    expect(score(900)).toBe(250);
  });
});

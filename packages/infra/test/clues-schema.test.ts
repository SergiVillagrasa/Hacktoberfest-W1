import { describe, expect, test } from 'vitest';
import { CluesSchema } from '../src/ai/vision-mastra';

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
const ok = { first: words(25), second: words(3), visual: words(12), judgeBusy: words(1) };

describe('CluesSchema', () => {
  test('accepts clues within the word limits', () => {
    expect(CluesSchema.safeParse(ok).success).toBe(true);
  });
  test('rejects empty, overlong and over-limit visual clues', () => {
    expect(CluesSchema.safeParse({ ...ok, first: '   ' }).success).toBe(false);
    expect(CluesSchema.safeParse({ ...ok, second: words(26) }).success).toBe(false);
    expect(CluesSchema.safeParse({ ...ok, visual: words(13) }).success).toBe(false);
  });
});

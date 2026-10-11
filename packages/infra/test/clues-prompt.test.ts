import { describe, expect, test } from 'vitest';
import { CLUES_PROMPT } from '../src/ai/prompts';

describe('clue prompt contract', () => {
  test('requests literal, photo-grounded descriptions instead of riddles', () => {
    expect(CLUES_PROMPT).toContain('easy, descriptive clues, not riddles');
    expect(CLUES_PROMPT).toContain('Only describe features clearly visible in the photo');
    expect(CLUES_PROMPT).toContain('Do not invent materials, softness, sounds, movement, or hidden features');
    expect(CLUES_PROMPT).toContain('No metaphors, rhymes, personification, or game-show introductions');
  });
  test('makes the first clue useful and the second add detail', () => {
    expect(CLUES_PROMPT).toContain('first: give two or three concrete visible features');
    expect(CLUES_PROMPT).toContain('second: add a distinctive visible detail not already in first');
    expect(CLUES_PROMPT).toContain('judgeBusy: another useful description');
  });
  test('preserves length limits and answer privacy', () => {
    expect(CLUES_PROMPT).toContain('English');
    expect(CLUES_PROMPT).toContain('at most 25 words');
    expect(CLUES_PROMPT).toContain('max 12 words');
    expect(CLUES_PROMPT).toContain('Never name the target object');
    expect(CLUES_PROMPT).toContain('Never reveal its location or describe the background');
    expect(CLUES_PROMPT).toContain('Never quote printed text or mention brands');
  });
});

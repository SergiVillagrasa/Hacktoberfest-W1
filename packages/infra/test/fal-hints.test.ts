import { describe, expect, test } from 'vitest';
import { PUG_ACTIONS, buildHintPrompt, loadPugMascot } from '../src/hints/fal-hints';

describe('fal hints', () => {
  test('prompt keeps the pug design rules and bans text and location cues', () => {
    const prompt = buildHintPrompt(PUG_ACTIONS[0]);
    for (const part of ['second image is the pug mascot', 'no blush or pink cheeks and no whiskers', 'no text', 'no location cues', PUG_ACTIONS[0]]) {
      expect(prompt).toContain(part);
    }
  });

  test('there are five distinct pug actions and the mascot asset loads as WebP', async () => {
    expect(new Set(PUG_ACTIONS).size).toBe(5);
    const mascot = await loadPugMascot();
    expect(Buffer.from(mascot.slice(0, 4)).toString()).toBe('RIFF');
    expect(mascot.length).toBeLessThan(100_000);
  });
});

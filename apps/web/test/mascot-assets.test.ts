import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { MASCOT_STATES, POSES } from '../src/components/mascot/states';

const pub = (path: string) => new URL(`../public/${path}`, import.meta.url);

describe('mascot assets', () => {
  test('all eight states have a pose image with the dimensions the component declares', () => {
    expect(MASCOT_STATES).toEqual(['idle', 'talking', 'thinking', 'celebrating', 'sad', 'shocked', 'countdown', 'trophy']);
    for (const state of MASCOT_STATES) {
      const bytes = readFileSync(pub(`mascot/${state}.webp`));
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.length).toBeLessThan(80_000);
      expect(POSES[state].alt.length).toBeGreaterThan(10);
      expect(existsSync(pub(`mascot/${state}.webp.json`))).toBe(true);
    }
  });

  test('every host announcement clip exists and is an MP3', () => {
    for (const clip of ['welcome', 'countdown', 'find', 'eliminated', 'solo', 'winner']) {
      const bytes = readFileSync(pub(`voice/${clip}.mp3`));
      expect(bytes.length).toBeGreaterThan(10_000);
      expect(bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 0xff).toBe(true);
    }
  });
});

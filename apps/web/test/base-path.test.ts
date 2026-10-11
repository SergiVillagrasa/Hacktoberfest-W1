import { describe, expect, test } from 'vitest';
import { withBase } from '../src/lib/base-path';

describe('base path', () => {
  test('public assets get the base path prefix, and nothing when served from the root', () => {
    expect(withBase('/mascot/idle.webp', '/projects/snaphunt')).toBe('/projects/snaphunt/mascot/idle.webp');
    expect(withBase('/voice/find.mp3', '')).toBe('/voice/find.mp3');
    expect(withBase('/voice/find.mp3')).toBe('/voice/find.mp3');
  });
});

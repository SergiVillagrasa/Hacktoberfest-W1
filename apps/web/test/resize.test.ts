import { describe, expect, test } from 'vitest';
import { MAX_FALLBACK_BYTES, MIN_SIDE, shrinkSideFor } from '../src/components/camera/resize';

describe('shrinkSideFor', () => {
  test('keeps any JPEG result regardless of size', () => {
    expect(shrinkSideFor({ type: 'image/jpeg', size: 5_000_000 }, 1280)).toBeNull();
    expect(shrinkSideFor({ type: 'image/jpeg', size: 100 }, 1280)).toBeNull();
  });

  test('keeps a non-JPEG result that fits the fallback budget', () => {
    expect(shrinkSideFor({ type: 'image/png', size: MAX_FALLBACK_BYTES }, 1280)).toBeNull();
    expect(shrinkSideFor({ type: 'image/webp', size: 100 }, 1280)).toBeNull();
  });

  test('shrinks an oversized PNG or WebP by 25%', () => {
    expect(shrinkSideFor({ type: 'image/png', size: MAX_FALLBACK_BYTES + 1 }, 1280)).toBe(960);
    expect(shrinkSideFor({ type: 'image/webp', size: MAX_FALLBACK_BYTES + 1 }, 960)).toBe(720);
    expect(shrinkSideFor({ type: 'image/png', size: MAX_FALLBACK_BYTES + 1 }, 720)).toBe(540);
  });

  test('stops shrinking below the minimum side and returns what it has', () => {
    expect(shrinkSideFor({ type: 'image/png', size: MAX_FALLBACK_BYTES + 1 }, 540)).toBeNull();
    expect(shrinkSideFor({ type: 'image/png', size: MAX_FALLBACK_BYTES + 1 }, MIN_SIDE)).toBeNull();
  });
});

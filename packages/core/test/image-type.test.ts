import { describe, expect, test } from 'vitest';
import { sniffImageType } from '../src';

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);

describe('sniffImageType', () => {
  test('detects JPEG, PNG and WebP from their magic bytes', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 1, 2))).toBe('image/jpeg');
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9))).toBe('image/png');
    expect(sniffImageType(new Uint8Array([...text('RIFF'), 1, 2, 3, 4, ...text('WEBP'), 0]))).toBe('image/webp');
  });

  test('returns null for garbage, empty and truncated input', () => {
    expect(sniffImageType(bytes(1, 2, 3, 4, 5))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e))).toBeNull();
  });

  test('a RIFF container that is not WEBP is rejected', () => {
    expect(sniffImageType(new Uint8Array([...text('RIFF'), 1, 2, 3, 4, ...text('WAVE'), 0]))).toBeNull();
  });
});

import { describe, expect, test } from 'vitest';
import { cleanNickname, isRoomCode, normalizeRoomCode } from '../src/lib/forms';

describe('forms', () => {
  test('room codes are uppercased, stripped of ambiguous characters and capped at 5', () => {
    expect(normalizeRoomCode('ab cd-e12')).toBe('ABCDE');
    expect(normalizeRoomCode('o0il1')).toBe('');
    expect(normalizeRoomCode('x7y8z9q')).toBe('X7Y8Z');
    expect(normalizeRoomCode('')).toBe('');
  });

  test('isRoomCode needs exactly five valid characters', () => {
    expect(isRoomCode('ABCDE')).toBe(true);
    expect(isRoomCode('ABCD')).toBe(false);
    expect(isRoomCode('abcde')).toBe(false);
    expect(isRoomCode('ABCD0')).toBe(false);
  });

  test('nicknames are trimmed, whitespace collapsed and capped at 20', () => {
    expect(cleanNickname('  Sam   Smith ')).toBe('Sam Smith');
    expect(cleanNickname('x'.repeat(30))).toHaveLength(20);
    expect(cleanNickname('   ')).toBe('');
  });
});

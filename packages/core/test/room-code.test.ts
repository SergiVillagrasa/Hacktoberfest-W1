import { expect, test } from 'bun:test';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, generateRoomCode, seededRng } from '../src';

test('room codes are 5 chars from the alphabet', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const code = generateRoomCode(seededRng(seed));
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
  }
});

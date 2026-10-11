import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants';
import type { Rng } from './types';

export function generateRoomCode(rng: Rng): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  return code;
}

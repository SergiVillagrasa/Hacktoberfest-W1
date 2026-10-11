export const TIME_LIMITS = [10, 15, 20, 30] as const;
export type TimeLimit = (typeof TIME_LIMITS)[number];

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
export const NICKNAME_MAX = 20;

export function normalizeRoomCode(raw: string): string {
  return [...raw.toUpperCase()].filter((ch) => ROOM_CODE_ALPHABET.includes(ch)).join('').slice(0, ROOM_CODE_LENGTH);
}

export const isRoomCode = (code: string) => normalizeRoomCode(code) === code && code.length === ROOM_CODE_LENGTH;

export function cleanNickname(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
}

import { describe, expect, test } from 'vitest';
import { CreateRoomBody, JoinRoomBody, RoomCodeParam, SubmitHeaders } from '../src';

describe('request schemas', () => {
  test('nickname is trimmed and limited to 1-20 chars', () => {
    expect(JoinRoomBody.parse({ nickname: '  Sam ' }).nickname).toBe('Sam');
    expect(JoinRoomBody.safeParse({ nickname: '   ' }).success).toBe(false);
    expect(JoinRoomBody.safeParse({ nickname: 'x'.repeat(21) }).success).toBe(false);
  });

  test('time limit must be one of the allowed options', () => {
    expect(CreateRoomBody.safeParse({ nickname: 'Sam', timeLimitMinutes: 15 }).success).toBe(true);
    expect(CreateRoomBody.safeParse({ nickname: 'Sam', timeLimitMinutes: 12 }).success).toBe(false);
  });

  test('room code rejects ambiguous characters and wrong length', () => {
    expect(RoomCodeParam.safeParse('ABCDE').success).toBe(true);
    expect(RoomCodeParam.safeParse('ABCD0').success).toBe(false);
    expect(RoomCodeParam.safeParse('ABCDO').success).toBe(false);
    expect(RoomCodeParam.safeParse('ABCD').success).toBe(false);
  });

  test('submissions need a UUID idempotency key', () => {
    expect(SubmitHeaders.safeParse({ 'idempotency-key': crypto.randomUUID() }).success).toBe(true);
    expect(SubmitHeaders.safeParse({ 'idempotency-key': 'abc' }).success).toBe(false);
  });
});

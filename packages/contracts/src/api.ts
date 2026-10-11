import { z } from 'zod';

export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

export const Nickname = z.string().trim().min(1).max(20);
export const RoomCodeParam = z.string().regex(ROOM_CODE_PATTERN);
export const TimeLimitMinutes = z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]);

export const CreateRoomBody = z.object({ nickname: Nickname, timeLimitMinutes: TimeLimitMinutes });
export const JoinRoomBody = z.object({ nickname: Nickname });
export const SubmitHeaders = z.object({ 'idempotency-key': z.uuid() });

export const GameErrorCodeSchema = z.enum([
  'not_found',
  'forbidden',
  'invalid_state',
  'room_full',
  'not_ready',
  'already_found',
  'not_active_player',
  'clue_not_active',
  'second_clue_used',
  'version_conflict',
]);

export const SessionResponse = z.object({ roomCode: RoomCodeParam, playerId: z.string(), token: z.string() });
export const SubmitResult = z.object({
  outcome: z.enum(['match', 'no_match', 'judge_busy', 'already_found']),
  points: z.number().int().optional(),
  attemptsLeft: z.number().int().min(0),
  message: z.string(),
});
export const ApiError = z.object({ code: GameErrorCodeSchema, message: z.string() });

export type CreateRoomBody = z.infer<typeof CreateRoomBody>;
export type JoinRoomBody = z.infer<typeof JoinRoomBody>;
export type SessionResponse = z.infer<typeof SessionResponse>;
export type SubmitResult = z.infer<typeof SubmitResult>;
export type ApiError = z.infer<typeof ApiError>;

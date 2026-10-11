import type { ApiError } from '@snaphunt/contracts';
import { GameError, type GameErrorCode } from '@snaphunt/core';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

const STATUS: Record<GameErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  not_active_player: 409,
  invalid_state: 409,
  room_full: 409,
  not_ready: 409,
  already_found: 409,
  clue_not_active: 409,
  second_clue_used: 409,
  version_conflict: 409,
};

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: GameErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const isClientError = (err: unknown): err is { status: number } => {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const reply = (status: number, body: ApiError) => res.status(status).json(body);
  if (err instanceof HttpError) return reply(err.status, { code: err.code, message: err.message });
  if (err instanceof GameError) return reply(STATUS[err.code], { code: err.code, message: err.message });
  if (err instanceof ZodError) return reply(400, { code: 'invalid_state', message: 'Invalid request' });
  if (isClientError(err)) return reply(err.status, { code: 'invalid_state', message: err.status === 413 ? 'Request body is too large' : 'Invalid request' });
  console.error(err);
  return reply(500, { code: 'invalid_state', message: 'Something went wrong' });
};

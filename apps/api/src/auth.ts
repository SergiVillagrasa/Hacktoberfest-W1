import { createHash, randomBytes } from 'node:crypto';
import type { GameRepository } from '@snaphunt/core';
import type { RequestHandler } from 'express';
import { HttpError } from './errors';

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface AuthedPlayer {
  roomCode: string;
  playerId: string;
}

declare global {
  namespace Express {
    interface Request {
      player?: AuthedPlayer;
    }
  }
}

export function requirePlayer(games: GameRepository, opts: { allowQueryToken?: boolean } = {}): RequestHandler {
  return async (req, _res, next) => {
    const header = req.header('authorization');
    const fromHeader = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const fromQuery = opts.allowQueryToken && typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = fromHeader ?? fromQuery;
    const player = token ? await games.findPlayerByTokenHash(hashToken(token)) : null;
    if (!player) throw new HttpError(401, 'forbidden', 'Missing or unknown session token');
    if (req.params.code && player.roomCode !== String(req.params.code).toUpperCase()) throw new HttpError(403, 'forbidden', 'Token does not belong to this room');
    req.player = player;
    next();
  };
}

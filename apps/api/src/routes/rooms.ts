import { CreateRoomBody, JoinRoomBody, RoomCodeParam, type SessionResponse } from '@snaphunt/contracts';
import { createRoom, joinRoom, removePlayer, type RoomDeps } from '@snaphunt/core';
import { Router } from 'express';
import { z } from 'zod';
import { requirePlayer } from '../auth';

const code = (raw: unknown) => RoomCodeParam.parse(String(raw).toUpperCase());

export function roomRoutes(deps: RoomDeps): Router {
  const router = Router();

  router.post('/rooms', async (req, res) => {
    const body = CreateRoomBody.parse(req.body);
    const session: SessionResponse = await createRoom(deps, body);
    res.status(201).json(session);
  });

  router.post('/rooms/:code/players', async (req, res) => {
    const session: SessionResponse = await joinRoom(deps, { code: code(req.params.code), ...JoinRoomBody.parse(req.body) });
    res.status(201).json(session);
  });

  router.delete('/rooms/:code/players/:playerId', requirePlayer(deps.games), async (req, res) => {
    await removePlayer(deps, { code: code(req.params.code), actorId: req.player!.playerId, playerId: z.string().min(1).parse(req.params.playerId) });
    res.status(204).end();
  });

  return router;
}

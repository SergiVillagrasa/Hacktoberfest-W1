import { RoomCodeParam } from '@snaphunt/contracts';
import { getView, requestSecondClue, startRoom, tick, type ViewDeps, type StartDeps } from '@snaphunt/core';
import { Router } from 'express';
import { z } from 'zod';
import { streamRoom, type SseOptions } from '../sse';
import { requirePlayer } from '../auth';

export function gameRoutes(deps: StartDeps & ViewDeps, sse: Partial<SseOptions> = {}): Router {
  const router = Router();
  const code = (raw: unknown) => RoomCodeParam.parse(String(raw).toUpperCase());

  router.post('/rooms/:code/start', requirePlayer(deps.games), async (req, res) => {
    const game = await startRoom(deps, { code: code(req.params.code), actorId: req.player!.playerId });
    res.json(await getView(deps, game, req.player!.playerId, deps.now()));
  });

  router.get('/rooms/:code', requirePlayer(deps.games), async (req, res) => {
    const game = await tick(deps, code(req.params.code));
    res.json(await getView(deps, game, req.player!.playerId, deps.now()));
  });

  router.post('/rooms/:code/clues/:clueId/second', requirePlayer(deps.games), async (req, res) => {
    const roomCode = code(req.params.code);
    await tick(deps, roomCode);
    const game = await requestSecondClue(deps, { code: roomCode, playerId: req.player!.playerId, clueId: z.string().min(1).parse(req.params.clueId) });
    res.json(await getView(deps, game, req.player!.playerId, deps.now()));
  });

  router.get('/rooms/:code/events', requirePlayer(deps.games, { allowQueryToken: true }), (req, res) =>
    streamRoom(deps, req, res, code(req.params.code), req.player!.playerId, sse),
  );

  return router;
}

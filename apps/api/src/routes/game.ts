import { RoomCodeParam } from '@snaphunt/contracts';
import { getView, startRoom, tick, type ViewDeps, type StartDeps } from '@snaphunt/core';
import { Router } from 'express';
import { requirePlayer } from '../auth';

export function gameRoutes(deps: StartDeps & ViewDeps): Router {
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

  return router;
}

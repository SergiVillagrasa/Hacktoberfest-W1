import { submitTarget, type TargetDeps } from '@snaphunt/core';
import express, { Router } from 'express';
import { requirePlayer } from '../auth';
import { HttpError } from '../errors';

export function targetRoutes(deps: TargetDeps): Router {
  const router = Router();

  router.put('/rooms/:code/target', requirePlayer(deps.games), express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '4mb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new HttpError(415, 'invalid_state', 'Send the photo as a JPEG, PNG or WebP image');
    const result = await submitTarget(deps, { code: req.player!.roomCode, playerId: req.player!.playerId, bytes: new Uint8Array(req.body) });
    res.status(202).json(result);
  });

  return router;
}

import { SubmitHeaders } from '@snaphunt/contracts';
import { submitFind, type FindDeps } from '@snaphunt/core';
import express, { Router } from 'express';
import { requirePlayer } from '../auth';
import { HttpError } from '../errors';

export function clueRoutes(deps: FindDeps): Router {
  const router = Router();

  router.post('/rooms/:code/clues/:clueId/submissions', requirePlayer(deps.games), express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '4mb' }), async (req, res) => {
    const { 'idempotency-key': idempotencyKey } = SubmitHeaders.parse({ 'idempotency-key': req.header('idempotency-key') });
    if (!Buffer.isBuffer(req.body)) throw new HttpError(415, 'invalid_state', 'Send the photo as a JPEG, PNG or WebP image');
    const result = await submitFind(deps, { code: req.player!.roomCode, playerId: req.player!.playerId, clueId: String(req.params.clueId), bytes: new Uint8Array(req.body), idempotencyKey });
    res.json(result);
  });

  return router;
}

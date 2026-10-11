import { type IdGen, type Rng, type TargetDeps } from '@snaphunt/core';
import cors from 'cors';
import express, { type Express } from 'express';
import { hashToken, newToken } from './auth';
import { errorHandler } from './errors';
import { gameRoutes } from './routes/game';
import type { SseOptions } from './sse';
import { roomRoutes } from './routes/rooms';
import { targetRoutes } from './routes/targets';

export interface AppDeps extends TargetDeps {
  now: () => Date;
  rng: Rng;
  newId: IdGen;
  webOrigin: string;
  sse?: Partial<SseOptions>;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(cors({ origin: deps.webOrigin }));
  app.get('/health', (_req, res) => void res.json({ ok: true }));
  app.use(targetRoutes(deps));
  app.use(express.json({ limit: '10kb' }));
  app.use(roomRoutes({ ...deps, newToken, hashToken }));
  app.use(gameRoutes(deps, deps.sse));
  app.use(errorHandler);
  return app;
}

import { type GameRepository, type IdGen, type Rng } from '@snaphunt/core';
import cors from 'cors';
import express, { type Express } from 'express';
import { hashToken, newToken } from './auth';
import { errorHandler } from './errors';
import { roomRoutes } from './routes/rooms';

export interface AppDeps {
  games: GameRepository;
  now: () => Date;
  rng: Rng;
  newId: IdGen;
  webOrigin: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(cors({ origin: deps.webOrigin }));
  app.use(express.json({ limit: '10kb' }));
  app.get('/health', (_req, res) => void res.json({ ok: true }));
  app.use(roomRoutes({ ...deps, newToken, hashToken }));
  app.use(errorHandler);
  return app;
}

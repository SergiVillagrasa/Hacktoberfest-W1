import { randomUUID } from 'node:crypto';
import { createDb, createGameRepository } from '@snaphunt/infra';
import type { AppDeps } from './app';
import type { Env } from './env';

export function compose(env: Env): AppDeps {
  return {
    games: createGameRepository(createDb(env.DATABASE_URL)),
    now: () => new Date(),
    rng: Math.random,
    newId: randomUUID,
    webOrigin: env.WEB_ORIGIN,
  };
}

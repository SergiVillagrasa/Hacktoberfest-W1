import { randomUUID } from 'node:crypto';
import { createDb, createElevenLabsSpeech, createFalHints, createGameRepository, createMastraVision, createSupabaseImageStore, loadPugMascot } from '@snaphunt/infra';
import type { AppDeps } from './app';
import type { Env } from './env';

export type Background = AppDeps['background'];

const logAndForget: Background = (task) => void task().catch((error) => console.error('background task failed', error));

export async function compose(env: Env, background: Background = logAndForget): Promise<AppDeps> {
  const apiKey = (env.VISION_MODEL.startsWith('google/') ? env.GOOGLE_AI_API_KEY : env.NEBIUS_API_KEY)!;
  return {
    games: createGameRepository(createDb(env.DATABASE_URL)),
    images: createSupabaseImageStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
    vision: createMastraVision({ modelId: env.VISION_MODEL, apiKey }),
    speech: createElevenLabsSpeech(env.ELEVENLABS_API_KEY),
    hints: createFalHints(env.FAL_KEY, { mascot: await loadPugMascot() }),
    background,
    now: () => new Date(),
    rng: Math.random,
    newId: randomUUID,
    webOrigin: env.WEB_ORIGIN,
  };
}

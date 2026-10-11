import { GameError, getView, tick, type Game, type StartDeps, type ViewDeps } from '@snaphunt/core';
import type { Request, Response } from 'express';

export interface SseOptions {
  pollMs: number;
  pingMs: number;
  maxMs: number;
}

export const DEFAULT_SSE: SseOptions = { pollMs: 1000, pingMs: 15_000, maxMs: 280_000 };

const clockDueAt = (game: Game) => (game.status === 'countdown' ? game.countdownEndsAt : game.status === 'active' ? game.endsAt : null);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function streamRoom(deps: StartDeps & ViewDeps, req: Request, res: Response, code: string, playerId: string, options: Partial<SseOptions> = {}) {
  const { pollMs, pingMs, maxMs } = { ...DEFAULT_SSE, ...options };
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();

  let open = true;
  req.on('close', () => void (open = false));
  const started = Date.now();
  let lastPing = started;
  let last: Game | null = null;

  try {
    while (open && Date.now() - started < maxMs) {
      const due = last && clockDueAt(last);
      const version = last ? await deps.games.version(code) : null;
      if (!last || version !== last.version || (due && deps.now() >= due)) {
        const game = await tick(deps, code);
        if (!last || game.version !== last.version) {
          const view = await getView(deps, game, playerId, deps.now());
          res.write(`event: view\nid: ${game.version}\ndata: ${JSON.stringify(view)}\n\n`);
        }
        last = game;
      }
      if (Date.now() - lastPing >= pingMs) {
        res.write(': ping\n\n');
        lastPing = Date.now();
      }
      await sleep(pollMs);
    }
  } catch (error) {
    if (!(error instanceof GameError)) console.error(error);
    const body = error instanceof GameError ? { code: error.code, message: error.message } : { code: 'invalid_state', message: 'Something went wrong' };
    if (open) res.write(`event: error\ndata: ${JSON.stringify(body)}\n\n`);
  }
  res.end();
}

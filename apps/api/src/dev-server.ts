import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createMemoryGameRepository, createMemorySubmissionRepository, type ClueSet, type ImageStore, type MatchEvidence } from '@snaphunt/core';
import { loadPugMascot } from '@snaphunt/infra';
import { createApp } from './app';

/**
 * Local API with fake providers: no database, no AI and no cost. Rooms live in memory.
 * The judge verdict is controlled with POST /__fake/verdict?outcome=match|no_match|busy, and picture generation
 * can be made to fail with POST /__fake/hints?mode=fail (mode=ok restores it).
 */
const port = Number(process.env.PORT ?? 8787);
const origin = `http://localhost:${port}`;

const files = new Map<string, { bytes: Uint8Array; type: string }>();
const typeOf = (path: string) => (path.endsWith('.mp3') ? 'audio/mpeg' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
const images: ImageStore = {
  put: async (path, bytes, type) => void files.set(path, { bytes, type }),
  get: async (path) => files.get(path)?.bytes ?? Promise.reject(new Error(`missing ${path}`)),
  signedUrl: async (path) => `${origin}/__img/${encodeURIComponent(path)}`,
};

const voice = new Uint8Array(await readFile(new URL('../../web/public/voice/find.mp3', import.meta.url)));
const mascot = await loadPugMascot();
let verdict: 'match' | 'no_match' | 'busy' = 'match';
let judgeDelayMs = 0;
let hintsWork = true;
let clueCount = 0;

const evidence = (sameObject: boolean): MatchEvidence => ({ sameObject, confidence: sameObject ? 0.95 : 0.9, matchingFeatures: [], differences: [] });
const clueSet = (n: number): ClueSet => ({
  first: `Clue ${n}: it is closer than you think, and a little bit shy.`,
  second: `Clue ${n}, the closer look: you can probably touch it without moving your feet much.`,
  visual: `Clue ${n}: study the picture, then look around.`,
  judgeBusy: `Clue ${n}, a bonus hint: it was here before the game started.`,
});

const submissions = createMemorySubmissionRepository();
const app = createApp({
  games: createMemoryGameRepository(submissions.all),
  submissions,
  images,
  vision: {
    validateTarget: async () => ({ accepted: true, reason: null, label: 'thing' }),
    writeClues: async () => clueSet(++clueCount),
    compare: async () => {
      if (judgeDelayMs) await new Promise((r) => setTimeout(r, judgeDelayMs));
      if (verdict === 'busy') throw new Error('fake judge is busy');
      return evidence(verdict === 'match');
    },
  },
  speech: { speak: async () => voice },
  hints: { stylize: async () => (hintsWork ? mascot : Promise.reject(new Error('fake picture generator is down'))) },
  background: (task) => void task().catch((error) => console.error('background task failed', error)),
  now: () => new Date(),
  rng: Math.random,
  newId: randomUUID,
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  sse: { pollMs: 400 },
  judgeBudgetMs: Number(process.env.JUDGE_BUDGET_MS ?? 20_000),
});

app.get('/__img/:path', (req, res) => {
  const file = files.get(decodeURIComponent(String(req.params.path)));
  if (!file) return void res.status(404).end();
  res.set({ 'content-type': file.type || typeOf(String(req.params.path)), 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
  res.send(Buffer.from(file.bytes));
});

app.post('/__fake/verdict', (req, res) => {
  const outcome = req.query.outcome;
  if (outcome === 'match' || outcome === 'no_match' || outcome === 'busy') verdict = outcome;
  if (req.query.delay !== undefined) judgeDelayMs = Math.max(0, Number(req.query.delay) || 0);
  res.json({ outcome: verdict, delay: judgeDelayMs });
});

app.post('/__fake/hints', (req, res) => {
  if (req.query.mode === 'ok' || req.query.mode === 'fail') hintsWork = req.query.mode === 'ok';
  res.json({ hints: hintsWork ? 'ok' : 'fail' });
});

app.listen(port, () => console.log(`SnapHunt fake API on ${origin} (judge verdict: ${verdict})`));

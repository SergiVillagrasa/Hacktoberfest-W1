import { SubmitResult } from '@snaphunt/contracts';
import type { Target } from '@snaphunt/core';
import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../src/app';
import { makeDeps } from './fakes';

const T0 = new Date('2026-10-11T10:00:00Z');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 1, 2]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
let clock: Date;
let ctx: ReturnType<typeof makeDeps>;
let app: ReturnType<typeof createApp>;
type Session = { roomCode: string; playerId: string; token: string };
const auth = (s: Session) => ({ authorization: `Bearer ${s.token}` });

beforeEach(() => {
  clock = T0;
  ctx = makeDeps({ now: () => new Date(clock.getTime() + 60_000) });
  app = createApp(ctx.deps);
});

async function startedRoom() {
  const ann = (await request(app).post('/rooms').send({ nickname: 'Ann', timeLimitMinutes: 10 })).body as Session;
  const bob = (await request(app).post(`/rooms/${ann.roomCode}/players`).send({ nickname: 'Bob' })).body as Session;
  const game = (await ctx.deps.games.loadByCode(ann.roomCode))!;
  const assets = { prep: 'ready' as const, clues: { first: 'f', second: 's', visual: 'v', judgeBusy: 'j' }, audio: { first: null, second: null, visual: null, judgeBusy: null }, hintPath: null };
  const targets: Target[] = [ann, bob].map((s, i) => ({ id: `t${i}`, ownerId: s.playerId, imagePath: `p${i}.jpg`, validation: 'accepted', rejectReason: null, foundBy: null, foundAt: null, points: null, assets }));
  for (const t of targets) ctx.files.set(t.imagePath, new Uint8Array([0xff, 0xd8, 0xff, 9]));
  await ctx.deps.games.save({ ...game, targets }, []);
  await request(app).post(`/rooms/${ann.roomCode}/start`).set(auth(ann));
  clock = new Date(T0.getTime());
  const view = (s: Session) => request(app).get(`/rooms/${ann.roomCode}`).set(auth(s));
  const countdownEnd = new Date((await view(ann)).body.countdownEndsAt);
  clock = new Date(countdownEnd.getTime() - 60_000 + 5000);
  return { ann, bob, code: ann.roomCode, clueOf: async (s: Session) => (await view(s)).body.myClues[0].id as string };
}
const submit = (code: string, clueId: string, s: Session | null, opts: { key?: string | null; body?: Buffer | string; type?: string } = {}) => {
  let req = request(app).post(`/rooms/${code}/clues/${clueId}/submissions`).set('content-type', opts.type ?? 'image/jpeg');
  if (s) req = req.set(auth(s));
  if (opts.key !== null) req = req.set('idempotency-key', opts.key ?? crypto.randomUUID());
  return req.send(opts.body ?? JPEG);
};

describe('POST /rooms/:code/clues/:clueId/submissions', () => {
  test('a matching photo returns match with points', async () => {
    const { bob, code, clueOf } = await startedRoom();
    const res = await submit(code, await clueOf(bob), bob);
    expect(res.status).toBe(200);
    expect(SubmitResult.safeParse(res.body).success).toBe(true);
    expect(res.body).toMatchObject({ outcome: 'match', attemptsLeft: 5 });
    expect(res.body.points).toBeGreaterThan(0);
  });

  test('a matching PNG photo labelled image/png returns match', async () => {
    const { bob, code, clueOf } = await startedRoom();
    const res = await submit(code, await clueOf(bob), bob, { body: PNG, type: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ outcome: 'match', attemptsLeft: 5 });
  });

  test('retrying with the same Idempotency-Key returns the same result', async () => {
    const { bob, code, clueOf } = await startedRoom();
    const key = crypto.randomUUID();
    const clue = await clueOf(bob);
    const first = await submit(code, clue, bob, { key });
    const again = await submit(code, clue, bob, { key });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
  });

  test('missing or malformed keys are 400, wrong media 415, no session 401, foreign clue 403', async () => {
    const { ann, bob, code, clueOf } = await startedRoom();
    const clue = await clueOf(bob);
    expect((await submit(code, clue, bob, { key: null })).status).toBe(400);
    expect((await submit(code, clue, bob, { key: 'not-a-uuid' })).status).toBe(400);
    expect((await submit(code, clue, bob, { body: 'hi', type: 'text/plain' })).status).toBe(415);
    expect((await submit(code, clue, null)).status).toBe(401);
    expect((await submit(code, clue, ann)).status).toBe(403);
  });

  test('a player who is out gets 409 not_active_player', async () => {
    const { bob, code, clueOf } = await startedRoom();
    const clue = await clueOf(bob);
    const game = (await ctx.deps.games.loadByCode(code))!;
    await ctx.deps.games.save({ ...game, players: game.players.map((p) => (p.id === bob.playerId ? { ...p, status: 'out_of_attempts' as const } : p)) }, []);
    const res = await submit(code, clue, bob);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('not_active_player');
  });
});

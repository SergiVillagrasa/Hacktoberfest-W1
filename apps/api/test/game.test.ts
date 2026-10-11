import { RoomView } from '@snaphunt/contracts';
import type { Target } from '@snaphunt/core';
import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../src/app';
import { makeDeps } from './fakes';

const T0 = new Date('2026-10-11T10:00:00Z');
let clock: Date;
let ctx: ReturnType<typeof makeDeps>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  clock = T0;
  ctx = makeDeps({ now: () => clock });
  app = createApp(ctx.deps);
});

type Session = { roomCode: string; playerId: string; token: string };
const auth = (s: Session) => ({ authorization: `Bearer ${s.token}` });

async function room(opts: { accepted?: boolean } = {}) {
  const ann = (await request(app).post('/rooms').send({ nickname: 'Ann', timeLimitMinutes: 10 })).body as Session;
  const bob = (await request(app).post(`/rooms/${ann.roomCode}/players`).send({ nickname: 'Bob' })).body as Session;
  const game = (await ctx.deps.games.loadByCode(ann.roomCode))!;
  const assets = { prep: 'ready' as const, clues: { first: 'f', second: 's', visual: 'v', judgeBusy: 'j' }, audio: { first: null, second: null, visual: null, judgeBusy: null }, hintPath: null };
  const targets: Target[] = [ann, bob].map((s, i) => ({ id: `t${i}`, ownerId: s.playerId, imagePath: `secret-${i}.jpg`, validation: opts.accepted === false ? 'pending' : 'accepted', rejectReason: null, foundBy: null, foundAt: null, points: null, assets }));
  await ctx.deps.games.save({ ...game, targets }, []);
  return { ann, bob, code: ann.roomCode };
}

describe('POST /rooms/:code/start', () => {
  test('the creator starts the countdown and gets their view', async () => {
    const { ann, code } = await room();
    const res = await request(app).post(`/rooms/${code}/start`).set(auth(ann));
    expect(res.status).toBe(200);
    expect(RoomView.safeParse(res.body).success).toBe(true);
    expect(res.body).toMatchObject({ status: 'countdown', me: { isCreator: true } });
    expect(new Date(res.body.countdownEndsAt).getTime()).toBe(T0.getTime() + 5000);
  });

  test('non-creators get 403, pending targets 409 not_ready, no token 401', async () => {
    const { ann, bob, code } = await room();
    expect((await request(app).post(`/rooms/${code}/start`).set(auth(bob))).status).toBe(403);
    expect((await request(app).post(`/rooms/${code}/start`)).status).toBe(401);
    const pending = await room({ accepted: false });
    const res = await request(app).post(`/rooms/${pending.code}/start`).set(auth(pending.ann));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('not_ready');
    expect(ann.roomCode).toBe(code);
  });
});

describe('GET /rooms/:code', () => {
  test('returns a schema-valid view that hides the other player\'s photo', async () => {
    const { ann, bob, code } = await room();
    const res = await request(app).get(`/rooms/${code}`).set(auth(bob));
    expect(res.status).toBe(200);
    expect(RoomView.safeParse(res.body).success).toBe(true);
    expect(res.body.myTarget.imageUrl).toContain('secret-1.jpg');
    expect(JSON.stringify(res.body)).not.toContain('secret-0.jpg');
    expect(res.body.players).toHaveLength(2);
    expect(ann.roomCode).toBe(code);
  });

  test('requires a session of the room', async () => {
    const a = await room();
    const b = await room();
    expect((await request(app).get(`/rooms/${a.code}`)).status).toBe(401);
    expect((await request(app).get(`/rooms/${a.code}`).set(auth(b.ann))).status).toBe(403);
  });

  test('after endsAt with every phone closed, the next request shows the finished game with ranking', async () => {
    const { ann, bob, code } = await room();
    await request(app).post(`/rooms/${code}/start`).set(auth(ann));
    clock = new Date(T0.getTime() + 5000 + 600_000 + 1);
    const res = await request(app).get(`/rooms/${code}`).set(auth(bob));
    expect(res.body.status).toBe('finished');
    expect(res.body.ranking).toHaveLength(2);
    expect(res.body.recap).toHaveLength(2);
    expect(res.body.recap[0].originalUrl).toContain('secret-');
  });

  test('countdown becomes active on the first request after it ends', async () => {
    const { ann, bob, code } = await room();
    await request(app).post(`/rooms/${code}/start`).set(auth(ann));
    clock = new Date(T0.getTime() + 5000);
    const res = await request(app).get(`/rooms/${code}`).set(auth(bob));
    expect(res.body.status).toBe('active');
    expect(res.body.myClues[0]).toMatchObject({ text: 'f' });
  });
});

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
type Session = { roomCode: string; playerId: string; token: string };

beforeEach(() => {
  clock = T0;
  ctx = makeDeps({ now: () => clock, sse: { pollMs: 15, pingMs: 60, maxMs: 450 } });
  app = createApp(ctx.deps);
});

async function room() {
  const ann = (await request(app).post('/rooms').send({ nickname: 'Ann', timeLimitMinutes: 10 })).body as Session;
  const bob = (await request(app).post(`/rooms/${ann.roomCode}/players`).send({ nickname: 'Bob' })).body as Session;
  const game = (await ctx.deps.games.loadByCode(ann.roomCode))!;
  const assets = { prep: 'ready' as const, clues: { first: 'f', second: 's', visual: 'v', judgeBusy: 'j' }, audio: { first: null, second: null, visual: null, judgeBusy: null }, hintPath: null };
  const targets: Target[] = [ann, bob].map((s, i) => ({ id: `t${i}`, ownerId: s.playerId, imagePath: `secret-${i}.jpg`, validation: 'accepted', rejectReason: null, foundBy: null, foundAt: null, points: null, assets }));
  await ctx.deps.games.save({ ...game, targets }, []);
  return { ann, bob, code: ann.roomCode };
}
const stream = (code: string, token: string) => request(app).get(`/rooms/${code}/events`).query({ token }).buffer(true).parse((res, cb) => {
  let text = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => (text += chunk));
  res.on('end', () => cb(null, text));
});
const views = (text: string) => [...text.matchAll(/event: view\nid: (\d+)\ndata: (.*)\n\n/g)].map((m) => ({ id: Number(m[1]), view: JSON.parse(m[2]!) }));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('GET /rooms/:code/events', () => {
  test('sends the current view immediately with SSE headers and ends at the max duration', async () => {
    const { bob, code } = await room();
    const res = await stream(code, bob.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toBe('no-cache, no-transform');
    const [first, ...rest] = views(res.body);
    expect(RoomView.safeParse(first!.view).success).toBe(true);
    expect(first!.view.me.playerId).toBe(bob.playerId);
    expect(rest).toEqual([]);
    expect(res.body).toContain(': ping');
  });

  test('pushes a new view when the room version changes', async () => {
    const { ann, bob, code } = await room();
    const pending = stream(code, bob.token).then((r) => r);
    await wait(120);
    await request(app).post(`/rooms/${code}/start`).set('authorization', `Bearer ${ann.token}`);
    const got = views((await pending).body);
    expect(got.map((v) => v.view.status)).toEqual(['lobby', 'countdown']);
    expect(got[1]!.id).toBeGreaterThan(got[0]!.id);
  });

  test('advances the clock for open streams without any request', async () => {
    const { ann, bob, code } = await room();
    await request(app).post(`/rooms/${code}/start`).set('authorization', `Bearer ${ann.token}`);
    const pending = stream(code, bob.token).then((r) => r);
    await wait(120);
    clock = new Date(T0.getTime() + 5000);
    const got = views((await pending).body);
    expect(got.map((v) => v.view.status)).toEqual(['countdown', 'active']);
  });

  test('each viewer only gets their own view', async () => {
    const { ann, code } = await room();
    const res = await stream(code, ann.token);
    expect(res.body).toContain('secret-0.jpg');
    expect(res.body).not.toContain('secret-1.jpg');
  });

  test('requires a valid session token in the query', async () => {
    const { code } = await room();
    expect((await request(app).get(`/rooms/${code}/events`)).status).toBe(401);
    expect((await request(app).get(`/rooms/${code}/events`).query({ token: 'nope' })).status).toBe(401);
  });
});

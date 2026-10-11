import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../src/app';
import { makeDeps } from './fakes';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
let ctx: ReturnType<typeof makeDeps>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  ctx = makeDeps();
  app = createApp(ctx.deps);
});

const create = async (nickname = 'Ann') => (await request(app).post('/rooms').send({ nickname, timeLimitMinutes: 10 })).body as { roomCode: string; playerId: string; token: string };
const upload = (code: string, token: string | null, body: Buffer | string = JPEG, type = 'image/jpeg') => {
  const req = request(app).put(`/rooms/${code}/target`).set('content-type', type);
  return (token ? req.set('authorization', `Bearer ${token}`) : req).send(body);
};

describe('PUT /rooms/:code/target', () => {
  test('accepts a JPEG with 202 pending, then the background work accepts it', async () => {
    const ann = await create();
    const res = await upload(ann.roomCode, ann.token);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ validation: 'pending' });
    await ctx.runBackground();
    const game = (await ctx.deps.games.loadByCode(ann.roomCode))!;
    expect(game.targets[0]).toMatchObject({ ownerId: ann.playerId, validation: 'accepted', assets: { prep: 'ready' } });
  });

  test('requires a session of this room', async () => {
    const a = await create('Ann');
    const b = await create('Bea');
    expect((await upload(a.roomCode, null)).status).toBe(401);
    expect((await upload(a.roomCode, b.token)).status).toBe(403);
  });

  test('wrong content type is 415 and non-JPEG bytes are rejected', async () => {
    const ann = await create();
    expect((await upload(ann.roomCode, ann.token, 'hello', 'text/plain')).status).toBe(415);
    const res = await upload(ann.roomCode, ann.token, Buffer.from([1, 2, 3, 4]));
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('JPEG');
  });

  test('photos over 4 MB are 413', async () => {
    const ann = await create();
    const big = Buffer.concat([JPEG, Buffer.alloc(4 * 1024 * 1024)]);
    expect((await upload(ann.roomCode, ann.token, big)).status).toBe(413);
  });

  test('uploads after the game started are 409', async () => {
    const ann = await create();
    await ctx.deps.games.save({ ...(await ctx.deps.games.loadByCode(ann.roomCode))!, status: 'countdown' }, []);
    const res = await upload(ann.roomCode, ann.token);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('invalid_state');
  });
});

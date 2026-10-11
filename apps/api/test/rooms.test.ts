import type { createMemoryGameRepository } from '@snaphunt/core';
import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../src/app';
import { makeDeps } from './fakes';

let games: ReturnType<typeof createMemoryGameRepository>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const { deps } = makeDeps();
  games = deps.games as typeof games;
  app = createApp(deps);
});

const create = async (nickname = 'Ann') => (await request(app).post('/rooms').send({ nickname, timeLimitMinutes: 10 })).body as { roomCode: string; playerId: string; token: string };
const join = (code: string, nickname: string) => request(app).post(`/rooms/${code}/players`).send({ nickname });

describe('rooms api', () => {
  test('POST /rooms creates a room and returns a session', async () => {
    const res = await request(app).post('/rooms').send({ nickname: 'Ann', timeLimitMinutes: 15 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ roomCode: expect.stringMatching(/^[A-Z2-9]{5}$/), playerId: expect.any(String), token: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain('hash');
  });

  test('join fills the room and the 7th player gets 409 room_full', async () => {
    const { roomCode } = await create();
    for (let i = 1; i < 6; i++) expect((await join(roomCode, `P${i}`)).status).toBe(201);
    const res = await join(roomCode, 'P6');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('room_full');
  });

  test('join accepts a lowercase code and 404s for unknown rooms', async () => {
    const { roomCode } = await create();
    expect((await join(roomCode.toLowerCase(), 'Bob')).status).toBe(201);
    expect((await join('ZZZZZ', 'Bob')).status).toBe(404);
  });

  test('join after the game started is 409 invalid_state', async () => {
    const { roomCode } = await create();
    await games.save({ ...(await games.loadByCode(roomCode))!, status: 'countdown' }, []);
    const res = await join(roomCode, 'Late');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('invalid_state');
  });

  test('bad bodies are 400', async () => {
    expect((await request(app).post('/rooms').send({ nickname: '', timeLimitMinutes: 10 })).status).toBe(400);
    expect((await request(app).post('/rooms').send({ nickname: 'Ann', timeLimitMinutes: 12 })).status).toBe(400);
    expect((await request(app).post('/rooms').send({ nickname: 'x'.repeat(21), timeLimitMinutes: 10 })).status).toBe(400);
    expect((await request(app).post('/rooms').set('content-type', 'application/json').send('{oops')).status).toBe(400);
  });

  test('oversized bodies are 413 and unsupported media is a 4xx, never a 500', async () => {
    const big = await request(app).post('/rooms').send({ nickname: 'Ann', timeLimitMinutes: 10, padding: 'x'.repeat(11_000) });
    expect(big.status).toBe(413);
    expect(big.body).toEqual({ code: 'invalid_state', message: 'Request body is too large' });
    const badCharset = await request(app).post('/rooms').set('content-type', 'application/json; charset=nope').send('{}');
    expect(badCharset.status).toBeGreaterThanOrEqual(400);
    expect(badCharset.status).toBeLessThan(500);
  });

  test('DELETE player: creator only, auth required, 204 on success', async () => {
    const ann = await create();
    const bob = (await join(ann.roomCode, 'Bob')).body;
    const url = (id: string) => `/rooms/${ann.roomCode}/players/${id}`;
    expect((await request(app).delete(url(bob.playerId))).status).toBe(401);
    expect((await request(app).delete(url(bob.playerId)).set('authorization', 'Bearer nope')).status).toBe(401);
    expect((await request(app).delete(url(ann.playerId)).set('authorization', `Bearer ${bob.token}`)).status).toBe(403);
    expect((await request(app).delete(url(bob.playerId)).set('authorization', `Bearer ${ann.token}`)).status).toBe(204);
    expect((await games.loadByCode(ann.roomCode))!.players).toHaveLength(1);
  });

  test('a token from another room is rejected', async () => {
    const a = await create('Ann');
    const b = await create('Bea');
    const res = await request(app).delete(`/rooms/${a.roomCode}/players/x`).set('authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(403);
  });

  test('CORS allows each configured web origin and no other', async () => {
    const { deps } = makeDeps({ webOrigin: 'https://example.tech, https://snaphunt-web.vercel.app' });
    const multi = createApp(deps);
    for (const origin of ['https://example.tech', 'https://snaphunt-web.vercel.app']) {
      const res = await request(multi).options('/rooms').set('origin', origin).set('access-control-request-method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
    const other = await request(multi).options('/rooms').set('origin', 'https://evil.example').set('access-control-request-method', 'POST');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

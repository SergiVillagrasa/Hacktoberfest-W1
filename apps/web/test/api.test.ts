import { describe, expect, test } from 'vitest';
import { ApiError, createApi } from '../src/lib/api';

const session = { roomCode: 'ABCDE', playerId: 'p1', token: 't1' };
const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createApi({ baseUrl: 'https://api.test', fetch: async (url, init) => (calls.push({ url: String(url), init: init ?? {} }), handler(String(url), init ?? {})) });
  return { api, calls };
}
const header = (init: RequestInit, name: string) => new Headers(init.headers).get(name);

describe('api client', () => {
  test('createRoom posts JSON and returns a validated session', async () => {
    const { api, calls } = setup(() => reply(201, session));
    expect(await api.createRoom({ nickname: 'Ann', timeLimitMinutes: 15 })).toEqual(session);
    expect(calls[0]).toMatchObject({ url: 'https://api.test/rooms' });
    expect(calls[0]!.init).toMatchObject({ method: 'POST', body: JSON.stringify({ nickname: 'Ann', timeLimitMinutes: 15 }) });
  });

  test('room routes uppercase the code and send the bearer token', async () => {
    const { api, calls } = setup(() => reply(204));
    await api.removePlayer('abcde', 'tok', 'p2');
    expect(calls[0]).toMatchObject({ url: 'https://api.test/rooms/ABCDE/players/p2' });
    expect(header(calls[0]!.init, 'authorization')).toBe('Bearer tok');
    expect(calls[0]!.init.method).toBe('DELETE');
  });

  test('uploads send raw JPEG and submissions carry the idempotency key', async () => {
    const { api, calls } = setup((url) => (url.endsWith('/target') ? reply(202, { validation: 'pending' }) : reply(200, { outcome: 'no_match', attemptsLeft: 4, message: 'Not quite' })));
    const photo = new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' });
    expect(await api.uploadTarget('ABCDE', 'tok', photo)).toEqual({ validation: 'pending' });
    expect(header(calls[0]!.init, 'content-type')).toBe('image/jpeg');
    const result = await api.submitFind('ABCDE', 'tok', 'clue-1', photo, 'key-1');
    expect(result).toMatchObject({ outcome: 'no_match', attemptsLeft: 4 });
    expect(header(calls[1]!.init, 'idempotency-key')).toBe('key-1');
    expect(calls[1]!.url).toBe('https://api.test/rooms/ABCDE/clues/clue-1/submissions');
  });

  test('server errors become ApiError with the status, code and friendly message', async () => {
    const { api } = setup(() => reply(409, { code: 'room_full', message: 'This room is full' }));
    await expect(api.joinRoom('ABCDE', { nickname: 'Bob' })).rejects.toMatchObject({ name: 'ApiError', status: 409, code: 'room_full', message: 'This room is full' });
    const { api: broken } = setup(() => reply(500));
    await expect(broken.getRoom('ABCDE', 't')).rejects.toBeInstanceOf(ApiError);
  });

  test('network failures become a status 0 network error', async () => {
    const { api } = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(api.getRoom('ABCDE', 't')).rejects.toMatchObject({ status: 0, code: 'network', message: expect.stringContaining('connection') });
  });

  test('responses that break the contract are rejected', async () => {
    const { api } = setup(() => reply(200, { nope: true }));
    await expect(api.getRoom('ABCDE', 't')).rejects.toThrow();
  });

  test('eventsUrl carries the token in the query', () => {
    const { api } = setup(() => reply(200));
    expect(api.eventsUrl('abcde', 'a b')).toBe('https://api.test/rooms/ABCDE/events?token=a%20b');
  });
});

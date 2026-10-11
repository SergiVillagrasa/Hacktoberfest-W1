import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { RoomView } from '@snaphunt/contracts';
import { connectRoomStream, type EventSourceLike } from '../src/lib/sse';

const view = (version: number, status: RoomView['status'] = 'lobby'): RoomView => ({
  code: 'ABCDE', status, phase: 'races', timeLimitMs: 600000, countdownEndsAt: null, endsAt: null, serverNow: '2026-10-11T10:00:00.000Z', version,
  me: { playerId: 'p1', isCreator: true, status: 'active', failedAttempts: 0, attemptsLeft: 5 },
  players: [], myClues: [], spectatorClues: [], feed: [], ranking: null, recap: null, myTarget: null,
});

class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];
  readyState = 0;
  closed = false;
  listeners = new Map<string, ((e: unknown) => void)[]>();
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(type: string, event: unknown = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}

function start(fetchView = vi.fn(async () => view(1))) {
  const views: RoomView[] = [];
  const connected: boolean[] = [];
  const fatal: string[] = [];
  const stream = connectRoomStream({ url: 'https://api/events', fetchView, onView: (v) => views.push(v), onConnected: (c) => connected.push(c), onFatal: (c) => fatal.push(c), EventSourceCtor: FakeEventSource as never });
  return { stream, views, connected, fatal, fetchView, es: () => FakeEventSource.instances.at(-1)! };
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('connectRoomStream', () => {
  test('shows the GET snapshot first, then pushes from the stream, ignoring stale versions', async () => {
    const t = start();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.views.map((v) => v.version)).toEqual([1]);
    t.es().emit('open');
    t.es().emit('view', { data: JSON.stringify(view(3, 'countdown')) });
    t.es().emit('view', { data: JSON.stringify(view(2)) });
    expect(t.views.map((v) => v.version)).toEqual([1, 3]);
    expect(t.connected.at(-1)).toBe(true);
    t.stream.close();
  });

  test('ignores malformed events', async () => {
    const t = start();
    await vi.advanceTimersByTimeAsync(0);
    t.es().emit('view', { data: '{broken' });
    t.es().emit('view', { data: JSON.stringify({ nope: 1 }) });
    expect(t.views).toHaveLength(1);
    t.stream.close();
  });

  test('reconnects with backoff and resyncs after the stream closes', async () => {
    const t = start();
    await vi.advanceTimersByTimeAsync(0);
    const first = t.es();
    first.readyState = 2;
    first.emit('error');
    expect(t.connected.at(-1)).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(t.fetchView).toHaveBeenCalledTimes(2);
    t.es().readyState = 2;
    t.es().emit('error');
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeEventSource.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeEventSource.instances).toHaveLength(3);
    t.stream.close();
  });

  test('lets the browser retry on its own while it is still connecting', async () => {
    const t = start();
    await vi.advanceTimersByTimeAsync(0);
    t.es().readyState = 0;
    t.es().emit('error');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    t.stream.close();
  });

  test('a forbidden or not_found server error is fatal and stops reconnecting', async () => {
    const t = start();
    await vi.advanceTimersByTimeAsync(0);
    t.es().emit('error', { data: JSON.stringify({ code: 'forbidden', message: 'nope' }) });
    expect(t.fatal).toEqual(['forbidden']);
    expect(t.es().closed).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  test('close stops everything and a failed resync is harmless', async () => {
    const t = start(vi.fn(async () => Promise.reject(new Error('offline'))));
    await vi.advanceTimersByTimeAsync(0);
    t.stream.close();
    t.es().readyState = 2;
    t.es().emit('error');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(t.views).toEqual([]);
  });
});

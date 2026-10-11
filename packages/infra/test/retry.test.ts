import { describe, expect, test } from 'vitest';
import { DeadlineExceeded, withRetry } from '../src/ai/retry';

const httpError = (statusCode: number) => Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });

function harness(start = 0) {
  let t = start;
  const delays: number[] = [];
  return {
    delays,
    now: () => t,
    sleep: async (ms: number) => {
      delays.push(ms);
      t += ms;
    },
  };
}

describe('withRetry', () => {
  test('succeeds on the third try after two 500s with 500 ms then 1 s delays', async () => {
    const h = harness();
    let calls = 0;
    const result = await withRetry(
      async () => {
        if (++calls < 3) throw httpError(500);
        return 'ok';
      },
      { deadlineMs: 20_000, ...h },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    expect(h.delays).toEqual([500, 1000]);
  });

  test('throws DeadlineExceeded when the next delay would pass the deadline', async () => {
    const h = harness();
    let calls = 0;
    const run = withRetry(
      async () => {
        calls++;
        throw httpError(503);
      },
      { deadlineMs: 2000, ...h },
    );
    await expect(run).rejects.toBeInstanceOf(DeadlineExceeded);
    expect(h.delays).toEqual([500, 1000]);
    expect(calls).toBe(3);
  });

  test('non-retryable errors throw immediately', async () => {
    const h = harness();
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw httpError(400);
        },
        { deadlineMs: 20_000, ...h },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(calls).toBe(1);
    expect(h.delays).toEqual([]);
  });

  test('aborts a hanging call at the deadline', async () => {
    const run = withRetry((signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))), { deadlineMs: 30 });
    await expect(run).rejects.toBeInstanceOf(DeadlineExceeded);
  });

  test('does not call fn when the parent signal is already aborted', async () => {
    const parent = new AbortController();
    parent.abort(new Error('cancelled'));
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        return 'ok';
      }, { deadlineMs: 1000, signal: parent.signal }),
    ).rejects.toThrow('cancelled');
    expect(calls).toBe(0);
  });
});

import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';

const generate = vi.hoisted(() => vi.fn());
vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    generate = generate;
    constructor(public opts: unknown) {}
  },
}));

const SCRIPT = fileURLToPath(new URL('../../../scripts/spikes/clue-spike.ts', import.meta.url));
const ROOT = realpathSync(fileURLToPath(new URL('../../..', import.meta.url)));
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 1, 2, 3, 4]);
const clues = { first: 'a red round thing', second: 'it has shiny parts', visual: 'a red round object', judgeBusy: 'a small red item' };

const created: string[] = [];
const tmp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'clue-spike-'));
  created.push(dir);
  return dir;
};
const photo = (dir: string, name: string) => {
  const path = join(dir, name);
  writeFileSync(path, JPEG);
  return path;
};
const httpError = (statusCode: number, message = `HTTP ${statusCode}`) => Object.assign(new Error(message), { statusCode });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  generate.mockReset();
  while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
});

async function attempt(args: string[]) {
  vi.resetModules();
  const argv = process.argv;
  process.argv = ['bun', 'clue-spike.ts', ...args];
  vi.stubEnv('NEBIUS_API_KEY', 'test-key');
  try {
    return await import(SCRIPT).then(() => null, (error: unknown) => error);
  } finally {
    process.argv = argv;
  }
}

describe('clue-spike smoke runner', () => {
  test('rejects a repo-relative output before touching photos or the provider', async () => {
    const nested = join(ROOT, 'packages', 'infra', 'test', 'reject-out', 'private-output.json');
    for (const out of ['private-output.json', nested]) {
      const error = await attempt([out, join(tmp(), 'missing-a.jpg'), join(tmp(), 'missing-b.jpg')]);
      expect(error).toMatchObject({ message: expect.stringContaining('outside the repository') });
      expect(existsSync(resolve(out))).toBe(false);
    }
    expect(generate).not.toHaveBeenCalled();
  });

  test('rejects a symlinked output directory that resolves inside the repository', async () => {
    const dir = tmp();
    const inner = mkdtempSync(join(ROOT, 'packages', 'infra', 'test', '.tmp-link-target-'));
    created.push(inner);
    const link = join(dir, 'linkdir');
    symlinkSync(inner, link, 'dir');
    const out = join(link, 'out.json');
    const error = await attempt([out, photo(dir, 'a.jpg'), photo(dir, 'b.jpg')]);
    expect(error).toMatchObject({ message: expect.stringContaining('outside the repository') });
    expect(generate).not.toHaveBeenCalled();
    expect(existsSync(out)).toBe(false);
  });

  test('a sibling directory sharing the repo basename prefix is still a valid outside output', async () => {
    const sibling = `${ROOT}-sibling-${Math.random().toString(36).slice(2)}`;
    mkdirSync(sibling);
    created.push(sibling);
    const dir = tmp();
    const out = join(sibling, 'out.json');
    generate.mockResolvedValue({ object: { ...clues } });
    const error = await attempt([out, photo(dir, 'a.jpg'), photo(dir, 'b.jpg')]);
    expect(error).toBeNull();
    expect(JSON.parse(readFileSync(out, 'utf8')).results).toHaveLength(2);
  });

  test('writes a private JSON file with one clue row per photo', async () => {
    const dir = tmp();
    const out = join(dir, 'out.json');
    const p1 = photo(dir, 'a.jpg');
    const p2 = photo(dir, 'b.jpg');
    generate.mockResolvedValue({ object: { ...clues } });
    expect(await attempt([out, p1, p2])).toBeNull();
    const saved = JSON.parse(readFileSync(out, 'utf8'));
    expect(saved.results).toMatchObject([{ path: p1, clues }, { path: p2, clues }]);
    expect(saved.results).toHaveLength(2);
    expect(statSync(out).mode & 0o777).toBe(0o600);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  test.each([429, 503])('retries a %s within one 30-second deadline and records a single success row', async (statusCode) => {
    const dir = tmp();
    const out = join(dir, 'out.json');
    const signals: AbortSignal[] = [];
    generate
      .mockImplementationOnce(async (_m: unknown, o: { abortSignal: AbortSignal }) => (signals.push(o.abortSignal), Promise.reject(httpError(statusCode))))
      .mockImplementation(async (_m: unknown, o: { abortSignal: AbortSignal }) => (signals.push(o.abortSignal), { object: { ...clues } }));
    expect(await attempt([out, photo(dir, 'a.jpg'), photo(dir, 'b.jpg')])).toBeNull();
    expect(generate).toHaveBeenCalledTimes(3);
    const saved = JSON.parse(readFileSync(out, 'utf8'));
    expect(saved.results).toHaveLength(2);
    expect(saved.results[0]).toMatchObject({ clues });
    expect(saved.results[0].error).toBeUndefined();
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[1]).toBe(signals[0]);
    expect(generate.mock.calls[0]![1]).toMatchObject({ modelSettings: { maxRetries: 0 } });
  });

  test('a non-retryable failure records one row, stops, and throws a sanitized error', async () => {
    const dir = tmp();
    const out = join(dir, 'out.json');
    generate.mockRejectedValue(httpError(400, 'provider echoed SECRET-REQUEST-BODY'));
    const error = await attempt([out, photo(dir, 'a.jpg'), photo(dir, 'b.jpg')]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(String(error)).toContain('smoke check failed');
    expect(String(error)).not.toContain('SECRET');
    const saved = JSON.parse(readFileSync(out, 'utf8'));
    expect(saved.results).toHaveLength(1);
    expect(saved.results[0].error).toBe('Call failed within the retry deadline.');
  });

  test('an existing outside file or symlink is never overwritten', async () => {
    const dir = tmp();
    const out = join(dir, 'out.json');
    writeFileSync(out, 'sentinel');
    const error = await attempt([out, photo(dir, 'a.jpg'), photo(dir, 'b.jpg')]);
    expect(error).not.toBeNull();
    expect(readFileSync(out, 'utf8')).toBe('sentinel');
    const link = join(dir, 'link.json');
    symlinkSync(out, link);
    const error2 = await attempt([link, photo(dir, 'a.jpg'), photo(dir, 'b.jpg')]);
    expect(error2).not.toBeNull();
    expect(readFileSync(out, 'utf8')).toBe('sentinel');
    expect(generate).not.toHaveBeenCalled();
  });

  test('a late path swap to a repo symlink cannot redirect saved results', async () => {
    const dir = tmp();
    const out = join(dir, 'out.json');
    const fixtureDir = mkdtempSync(join(ROOT, 'packages', 'infra', 'test', '.tmp-swap-target-'));
    created.push(fixtureDir);
    const fixture = join(fixtureDir, 'fixture.json');
    writeFileSync(fixture, 'sentinel');
    generate.mockImplementationOnce(async () => {
      unlinkSync(out);
      symlinkSync(fixture, out);
      return { object: { ...clues } };
    });
    generate.mockResolvedValue({ object: { ...clues } });
    const error = await attempt([out, photo(dir, 'a.jpg'), photo(dir, 'b.jpg')]);
    expect(error).toBeNull();
    expect(readFileSync(fixture, 'utf8')).toBe('sentinel');
    expect(statSync(fixture).mode & 0o777).not.toBe(0o600);
  });

  test('the shared 30-second deadline aborts a hanging judge without resetting', async () => {
    vi.useFakeTimers();
    const dir = tmp();
    const out = join(dir, 'out.json');
    let seen: AbortSignal | undefined;
    generate.mockImplementation(async (_m: unknown, o: { abortSignal: AbortSignal }) => {
      seen = o.abortSignal;
      return new Promise((_, reject) => o.abortSignal.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const run = attempt([out, photo(dir, 'a.jpg'), photo(dir, 'b.jpg')]);
    await vi.advanceTimersByTimeAsync(30_000);
    const error = await run;
    expect(error).not.toBeNull();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(seen!.aborted).toBe(true);
    expect(JSON.parse(readFileSync(out, 'utf8')).results).toMatchObject([{ error: 'Call failed within the retry deadline.' }]);
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAnnouncementQueue, DEFAULT_HOLD_MS, MAX_HOLD_MS, type Moment } from '../src/lib/announcementQueue';

function setup(opts: { blocked?: boolean; neverEnds?: boolean } = {}) {
  const shown: (string | null)[] = [];
  const clips: string[] = [];
  const busy: boolean[] = [];
  let endClip: (() => void) | undefined;
  const queue = createAnnouncementQueue({
    show: (m) => shown.push(m ? m.line : null),
    playClip: async (clip, onEnd) => {
      clips.push(clip);
      endClip = onEnd;
      if (!opts.blocked && !opts.neverEnds) setTimeout(onEnd, 1000);
      return !opts.blocked;
    },
    setBusy: (b) => busy.push(b),
  });
  const m = (line: string, extra: Partial<Moment> = {}): Moment => ({ state: 'talking', line, ...extra });
  return { queue, shown, clips, busy, m, endClip: () => endClip?.() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('announcement queue', () => {
  test('simultaneous events play one after another, each held for its minimum time', async () => {
    const t = setup();
    t.queue.push(t.m('found', { clip: 'find' }));
    t.queue.push(t.m('knocked out', { clip: 'eliminated' }));
    t.queue.push(t.m('new picture clue'));
    expect(t.shown).toEqual(['found']);
    await vi.advanceTimersByTimeAsync(DEFAULT_HOLD_MS - 1);
    expect(t.shown).toEqual(['found']);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.shown).toEqual(['found', 'knocked out']);
    await vi.advanceTimersByTimeAsync(DEFAULT_HOLD_MS);
    expect(t.shown).toEqual(['found', 'knocked out', 'new picture clue']);
    await vi.advanceTimersByTimeAsync(DEFAULT_HOLD_MS);
    expect(t.shown.at(-1)).toBeNull();
    expect(t.clips).toEqual(['find', 'eliminated']);
    expect(t.busy).toEqual([true, true, true, false]);
  });

  test('a clip is never cut off: the next moment waits for it to end', async () => {
    const t = setup({ neverEnds: true });
    t.queue.push(t.m('first', { clip: 'eliminated' }));
    t.queue.push(t.m('second'));
    await vi.advanceTimersByTimeAsync(DEFAULT_HOLD_MS + 2000);
    expect(t.shown).toEqual(['first']);
    t.endClip();
    expect(t.shown).toEqual(['first', 'second']);
  });

  test('a clip that never ends is cut off by the hard cap', async () => {
    const t = setup({ neverEnds: true });
    t.queue.push(t.m('first', { clip: 'winner' }));
    t.queue.push(t.m('second'));
    await vi.advanceTimersByTimeAsync(MAX_HOLD_MS);
    expect(t.shown).toEqual(['first', 'second']);
  });

  test('a blocked clip does not stall the queue', async () => {
    const t = setup({ blocked: true });
    t.queue.push(t.m('first', { clip: 'find' }));
    t.queue.push(t.m('second'));
    await vi.advanceTimersByTimeAsync(DEFAULT_HOLD_MS);
    expect(t.shown).toEqual(['first', 'second']);
  });

  test('custom hold times, idle restarts and clearing', async () => {
    const t = setup();
    t.queue.push(t.m('own result', { holdMs: 4500 }));
    t.queue.push(t.m('after'));
    await vi.advanceTimersByTimeAsync(4499);
    expect(t.shown).toEqual(['own result']);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.shown).toEqual(['own result', 'after']);
    await vi.advanceTimersByTimeAsync(DEFAULT_HOLD_MS);
    t.queue.push(t.m('again'));
    expect(t.shown.at(-1)).toBe('again');
    t.queue.clear();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.shown.at(-1)).toBe('again');
  });
});

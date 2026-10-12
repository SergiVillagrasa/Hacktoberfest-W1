import type { ClueView, SubmitResult } from '@snaphunt/contracts';
import { describe, expect, test } from 'vitest';
import { acceptJudgementResult, isJudging, reconcileAwaitedJudgement, unseenJudgementResults } from '../src/lib/judgements';

const clue = (id: string, status: ClueView['status'], submission?: ClueView['submission']): ClueView => ({
  id,
  kind: 'voice',
  status,
  targetId: 't1',
  text: null,
  secondText: null,
  judgeBusyText: null,
  audioUrl: null,
  secondAudioUrl: null,
  judgeBusyAudioUrl: null,
  hintUrl: null,
  hintStatus: null,
  secondClueUsed: false,
  issuedAt: '2026-10-11T10:00:00.000Z',
  submission,
});
const result = (id: string, outcome: SubmitResult['outcome']): SubmitResult => ({ outcome, submissionId: id, pending: false, attemptsLeft: 4, message: 'm' });

describe('unseenJudgementResults', () => {
  test('collects final results from every own clue including inactive ones', () => {
    const seen = new Set<string>();
    const clues = [
      clue('won', 'won', { id: 's1', pending: false, result: result('s1', 'match') }),
      clue('lost', 'lost', { id: 's2', pending: false, result: result('s2', 'no_match') }),
      clue('cancelled', 'cancelled', { id: 's3', pending: false, result: result('s3', 'judge_busy') }),
      clue('active', 'active', { id: 's4', pending: true, result: null }),
      clue('plain', 'active'),
    ];
    expect(unseenJudgementResults(clues, seen).map((r) => r.submissionId)).toEqual(['s1', 's2', 's3']);
    expect(seen).toEqual(new Set(['s1', 's2', 's3']));
  });

  test('dedupes results already seen from the HTTP response or a previous view', () => {
    const seen = new Set<string>(['s1']);
    const clues = [clue('a', 'active', { id: 's1', pending: false, result: result('s1', 'no_match') }), clue('b', 'active', { id: 's2', pending: false, result: result('s2', 'already_found') })];
    expect(unseenJudgementResults(clues, seen).map((r) => r.submissionId)).toEqual(['s2']);
    expect(unseenJudgementResults(clues, seen)).toEqual([]);
  });

  test('a pending submission is never reported and can still finalize later', () => {
    const seen = new Set<string>();
    const clues = [clue('a', 'active', { id: 's1', pending: true, result: null })];
    expect(unseenJudgementResults(clues, seen)).toEqual([]);
    expect(seen.size).toBe(0);
    clues[0] = clue('a', 'active', { id: 's1', pending: false, result: result('s1', 'judge_busy') });
    expect(unseenJudgementResults(clues, seen).map((r) => r.submissionId)).toEqual(['s1']);
  });
});

describe('acceptJudgementResult', () => {
  test('whichever of HTTP or SSE delivers a final result first wins, the other is ignored', async () => {
    const seen = new Set<string>();
    const miss = result('s1', 'no_match');
    expect(acceptJudgementResult(miss, seen)).toBe(true);
    const clues = [clue('a', 'active', { id: 's1', pending: false, result: miss })];
    expect(unseenJudgementResults(clues, seen)).toEqual([]);
    const seen2 = new Set<string>();
    expect(unseenJudgementResults(clues, seen2)).toEqual([miss]);
    expect(acceptJudgementResult(miss, seen2)).toBe(false);
  });

  test('a pending result never claims the id and a final one still reacts once', () => {
    const seen = new Set<string>();
    const pending = { ...result('s1', 'judge_busy'), pending: true };
    expect(acceptJudgementResult(pending, seen)).toBe(true);
    expect(seen.size).toBe(0);
    const miss = result('s1', 'no_match');
    expect(acceptJudgementResult(miss, seen)).toBe(true);
    expect(acceptJudgementResult(pending, seen)).toBe(false);
    expect(acceptJudgementResult(miss, seen)).toBe(false);
  });

  test('a delayed own match still routes to the reaction path', () => {
    const seen = new Set<string>();
    expect(acceptJudgementResult(result('s9', 'match'), seen)).toBe(true);
    const clues = [clue('a', 'won', { id: 's9', pending: false, result: result('s9', 'match') })];
    expect(unseenJudgementResults(clues, seen)).toEqual([]);
  });
});

describe('reconcileAwaitedJudgement', () => {
  const sub = (id: string, pending: boolean): ClueView['submission'] => ({ id, pending, result: pending ? null : result(id, 'match') });
  test('clears the awaited id only when its authoritative final arrives', () => {
    let awaited: string | null = 's1';
    expect(reconcileAwaitedJudgement(sub('s1', true), awaited)).toBe('s1');
    expect(reconcileAwaitedJudgement(sub('s1', false), awaited)).toBeNull();
    awaited = reconcileAwaitedJudgement(sub('s1', false), awaited);
    expect(isJudging(sub('s2', true), awaited)).toBe(true);
    expect(reconcileAwaitedJudgement(sub('s2', false), awaited)).toBeNull();
    expect(isJudging(sub('s2', false), awaited)).toBe(false);
  });
  test('a final view that beats a stale soft response still clears once it is awaited', () => {
    expect(reconcileAwaitedJudgement(sub('s1', false), 's1')).toBeNull();
    expect(reconcileAwaitedJudgement(sub('s1', false), null)).toBeNull();
    expect(reconcileAwaitedJudgement(sub('s2', false), 's1')).toBe('s1');
  });
});

describe('isJudging', () => {
  const sub = (id: string, pending: boolean): ClueView['submission'] => ({ id, pending, result: pending ? null : result(id, 'match') });
  test('a pending clue or an awaited soft response disables capture', () => {
    expect(isJudging(sub('s1', true), null)).toBe(true);
    expect(isJudging(undefined, 's1')).toBe(true);
    expect(isJudging(sub('s0', false), 's1')).toBe(true);
    expect(isJudging(undefined, null)).toBe(false);
    expect(isJudging(sub('s1', false), null)).toBe(false);
  });
  test('a final view that beats the soft HTTP response does not revert to pending', () => {
    expect(isJudging(sub('s1', false), 's1')).toBe(false);
  });
});

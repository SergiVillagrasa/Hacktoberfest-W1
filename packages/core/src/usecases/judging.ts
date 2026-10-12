import type { SubmitResult } from '@snaphunt/contracts';
import { MAX_FAILED_ATTEMPTS } from '../domain/constants';
import type { Game, Judgement } from '../domain/types';
import type { StoredSubmission } from '../ports';

export const JUDGE_PENDING_MESSAGE = "The judge needs a little longer — here's a bonus clue while I keep checking your photo.";
export const JUDGE_RETRY_MESSAGE = "The judge couldn't check your photo. Please try again — no attempt was used.";
export const JUDGE_ENDED_MESSAGE = 'The hunt ended before the judge could check your photo — it was not counted.';
export const JUDGEMENT_GRACE_MS = 5000;

export const MESSAGES: Record<SubmitResult['outcome'], string> = {
  match: 'You found it!',
  no_match: "Not quite — that's not the one. Keep looking!",
  judge_busy: JUDGE_RETRY_MESSAGE,
  already_found: 'Too late — someone just found it!',
};

const attemptsLeft = (game: Game, playerId: string) => Math.max(0, MAX_FAILED_ATTEMPTS - (game.players.find((p) => p.id === playerId)?.failedAttempts ?? 0));

export function judgeResult(outcome: SubmitResult['outcome'], game: Game, playerId: string, points?: number | null, extra: { message?: string; pending?: boolean; submissionId?: string } = {}): SubmitResult {
  return {
    outcome,
    ...(extra.submissionId ? { submissionId: extra.submissionId } : {}),
    ...(extra.pending !== undefined ? { pending: extra.pending } : {}),
    ...(points != null ? { points } : {}),
    attemptsLeft: attemptsLeft(game, playerId),
    message: extra.message ?? MESSAGES[outcome],
  };
}

export function pendingResult(game: Game, playerId: string, submissionId: string): SubmitResult {
  return judgeResult('judge_busy', game, playerId, null, { message: JUDGE_PENDING_MESSAGE, pending: true, submissionId });
}

export function judgementSubmission(judgement: Judgement, roomId: string, clueId: string, playerId: string, result: SubmitResult | null, evidence: unknown, createdAt: Date): StoredSubmission {
  return {
    id: judgement.id,
    roomId,
    clueId,
    playerId,
    idempotencyKey: judgement.idempotencyKey,
    imagePath: judgement.imagePath,
    outcome: result ? result.outcome : 'pending',
    points: result?.points ?? null,
    evidence,
    createdAt,
  };
}

export function expireJudgements(game: Game, now: Date): { game: Game; submissions: StoredSubmission[] } {
  const submissions: StoredSubmission[] = [];
  const clues = game.clues.map((c) => {
    const judgement = c.judgement;
    if (!judgement || judgement.result) return c;
    const target = game.targets.find((t) => t.id === c.targetId);
    const claimed = !!target && target.foundBy !== null;
    const inactive = game.status !== 'active' || c.status !== 'active' || game.players.find((p) => p.id === c.hunterId)?.status !== 'active';
    if (!claimed && !inactive && judgement.expiresAt > now.getTime()) return c;
    const result = claimed
      ? judgeResult('already_found', game, c.hunterId, null, { submissionId: judgement.id, pending: false })
      : judgeResult('judge_busy', game, c.hunterId, null, { message: inactive ? JUDGE_ENDED_MESSAGE : JUDGE_RETRY_MESSAGE, submissionId: judgement.id, pending: false });
    submissions.push(judgementSubmission(judgement, game.roomId, c.id, c.hunterId, result, null, new Date(judgement.startedAt)));
    return { ...c, judgement: { ...judgement, result } };
  });
  return submissions.length ? { game: { ...game, clues }, submissions } : { game, submissions };
}

import type { ClueView, SubmitResult } from '@snaphunt/contracts';

export function unseenJudgementResults(clues: ClueView[], seen: Set<string>): SubmitResult[] {
  const results: SubmitResult[] = [];
  for (const clue of clues) {
    const submission = clue.submission;
    if (!submission || submission.pending || !submission.result || seen.has(submission.id)) continue;
    seen.add(submission.id);
    results.push(submission.result);
  }
  return results;
}

export function acceptJudgementResult(result: SubmitResult, seen: Set<string>): boolean {
  if (result.submissionId && seen.has(result.submissionId)) return false;
  if (!result.pending && result.submissionId) seen.add(result.submissionId);
  return true;
}

export function reconcileAwaitedJudgement(submission: ClueView['submission'], awaitedSubmissionId: string | null): string | null {
  return awaitedSubmissionId !== null && submission?.id === awaitedSubmissionId && !submission.pending ? null : awaitedSubmissionId;
}

export function isJudging(submission: ClueView['submission'], awaitedSubmissionId: string | null): boolean {
  if (submission?.id === awaitedSubmissionId) return submission.pending;
  if (submission?.pending) return true;
  return awaitedSubmissionId !== null;
}

import type { StoredSubmission, SubmissionRepository } from '../ports';

export function createMemorySubmissionRepository(): SubmissionRepository & { all: StoredSubmission[] } {
  const all: StoredSubmission[] = [];
  return {
    all,
    async findByKey(key) {
      const found = all.find((s) => s.idempotencyKey === key);
      return found ? structuredClone(found) : null;
    },
    async listMatches(roomId) {
      return structuredClone(all.filter((s) => s.roomId === roomId && s.outcome === 'match'));
    },
    async record(submission) {
      if (!all.some((s) => s.idempotencyKey === submission.idempotencyKey)) all.push(structuredClone(submission));
    },
  };
}

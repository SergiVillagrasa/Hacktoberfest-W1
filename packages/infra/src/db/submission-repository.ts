import { eq } from 'drizzle-orm';
import type { StoredSubmission, SubmissionOutcome, SubmissionRepository } from '@snaphunt/core';
import type { Db } from './client';
import { submissions } from './schema';

type Evidence = { points: number | null; detail: unknown };

export function createSubmissionRepository(db: Db): SubmissionRepository {
  return {
    async findByKey(key) {
      const [row] = await db.select().from(submissions).where(eq(submissions.idempotencyKey, key));
      if (!row) return null;
      const stored = row.evidence as Evidence | null;
      return {
        id: row.id,
        roomId: row.roomId,
        clueId: row.clueId,
        playerId: row.playerId,
        idempotencyKey: row.idempotencyKey,
        imagePath: row.imagePath,
        outcome: row.outcome as SubmissionOutcome,
        points: stored?.points ?? null,
        evidence: stored?.detail ?? null,
        createdAt: row.createdAt,
      } satisfies StoredSubmission;
    },

    async record(s) {
      await db
        .insert(submissions)
        .values({
          id: s.id,
          roomId: s.roomId,
          clueId: s.clueId,
          playerId: s.playerId,
          idempotencyKey: s.idempotencyKey,
          imagePath: s.imagePath,
          outcome: s.outcome,
          evidence: { points: s.points, detail: s.evidence } satisfies Evidence,
          createdAt: s.createdAt,
        })
        .onConflictDoNothing({ target: submissions.idempotencyKey });
    },
  };
}
